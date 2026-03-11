import { createHash } from "node:crypto";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { env } from "../config.js";
import { requireAuth } from "../auth.js";
import {
  acquireFileLock,
  createAuditEvent,
  findFileById,
  findUserById,
  releaseFileLock,
  replaceFileContent
} from "../db.js";
import { resolveFileAccess, resolveTargetManageAccess } from "../permissions.js";
import { readBuffer, saveBuffer } from "../storage.js";

const editorParamsSchema = z.object({
  fileId: z.string().uuid()
});

const callbackBodySchema = z.object({
  status: z.number(),
  url: z.string().url().optional(),
  users: z.array(z.string()).optional()
});

type EditorModeReason =
  | "EDIT_LOCK_ACQUIRED"
  | "EDIT_LOCK_RENEWED"
  | "LOCKED_BY_OTHER_USER"
  | "READ_ONLY_PERMISSION";

function onlyOfficeSecret(): string {
  return env.ONLYOFFICE_JWT_SECRET ?? env.JWT_SECRET;
}

function onlyOfficePublicUrl(): string {
  if (!env.ONLYOFFICE_DOCUMENT_SERVER_URL) {
    throw new Error("ONLYOFFICE document server is not configured.");
  }

  return env.ONLYOFFICE_DOCUMENT_SERVER_URL;
}

function onlyOfficeInternalUrl(): string {
  const internalUrl = env.ONLYOFFICE_DOCUMENT_SERVER_INTERNAL_URL ?? env.ONLYOFFICE_DOCUMENT_SERVER_URL;
  if (!internalUrl) {
    throw new Error("ONLYOFFICE document server is not configured.");
  }

  return internalUrl;
}

function extensionForFile(fileName: string): string {
  const parts = fileName.split(".");
  const extension = parts.at(-1);
  return parts.length > 1 && extension ? extension.toLowerCase() : "";
}

function resolveDocumentType(fileName: string): {
  documentType: "word" | "cell" | "slide";
  fileType: string;
} {
  const extension = extensionForFile(fileName);
  switch (extension) {
    case "docx":
      return { documentType: "word", fileType: "docx" };
    case "xlsx":
      return { documentType: "cell", fileType: "xlsx" };
    case "pptx":
      return { documentType: "slide", fileType: "pptx" };
    default:
      throw new Error("ONLYOFFICE integration currently supports only docx, xlsx, and pptx files.");
  }
}

function signEditorToken(
  payload: Record<string, unknown>,
  expiresIn: SignOptions["expiresIn"] = "15m"
): string {
  return jwt.sign(payload, onlyOfficeSecret(), {
    expiresIn
  });
}

function verifyEditorToken(token: string, expectedPurpose: string, fileId: string): void {
  const decoded = jwt.verify(token, onlyOfficeSecret()) as {
    purpose?: string;
    fileId?: string;
  };

  if (decoded.purpose !== expectedPurpose || decoded.fileId !== fileId) {
    throw new Error("Invalid editor token.");
  }
}

function allowedOnlyOfficeOrigins(): string[] {
  const origins = new Set<string>();

  if (env.ONLYOFFICE_DOCUMENT_SERVER_URL) {
    origins.add(new URL(env.ONLYOFFICE_DOCUMENT_SERVER_URL).origin);
  }

  if (env.ONLYOFFICE_DOCUMENT_SERVER_INTERNAL_URL) {
    origins.add(new URL(env.ONLYOFFICE_DOCUMENT_SERVER_INTERNAL_URL).origin);
  }

  return [...origins];
}

function ensureAllowedOnlyOfficeCallbackUrl(callbackUrl: string): void {
  const actualOrigin = new URL(callbackUrl).origin;
  if (!allowedOnlyOfficeOrigins().includes(actualOrigin)) {
    throw new Error("ONLYOFFICE callback URL origin does not match the configured document server.");
  }
}

function normalizeOnlyOfficeDownloadUrl(callbackUrl: string): string {
  ensureAllowedOnlyOfficeCallbackUrl(callbackUrl);

  const internalOrigin = new URL(onlyOfficeInternalUrl()).origin;
  const normalized = new URL(callbackUrl);
  normalized.protocol = new URL(internalOrigin).protocol;
  normalized.host = new URL(internalOrigin).host;
  return normalized.toString();
}

async function fetchOnlyOfficeCallbackContent(callbackUrl: string): Promise<Response> {
  const normalizedUrl = normalizeOnlyOfficeDownloadUrl(callbackUrl);
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      const response = await fetch(normalizedUrl, {
        signal: AbortSignal.timeout(2000)
      });

      if (response.ok) {
        return response;
      }

      lastError = new Error(`ONLYOFFICE callback download returned status ${response.status}.`);
    } catch (error) {
      lastError = error as Error;
    }

    if (attempt < 30) {
      await new Promise((resolve) => {
        setTimeout(resolve, 1000);
      });
    }
  }

  throw new Error(`Failed to fetch saved content from ONLYOFFICE callback URL after retries: ${lastError?.message ?? "unknown error"}`);
}

export async function registerEditorRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/editor/files/:fileId/session",
    {
      preHandler: requireAuth
    },
    async (request, reply) => {
      if (!request.requestUser) {
        return reply.code(401).send({ message: "Unauthorized." });
      }

      if (!env.ONLYOFFICE_DOCUMENT_SERVER_URL) {
        return reply.code(400).send({ message: "ONLYOFFICE document server is not configured." });
      }

      const params = editorParamsSchema.parse(request.params);

      try {
        const resolved = await resolveFileAccess({
          user: request.requestUser,
          fileId: params.fileId
        });

        const { documentType, fileType } = resolveDocumentType(resolved.file.originalName);
        const accessToken = signEditorToken({
          purpose: "onlyoffice-content",
          fileId: resolved.file.id
        }, "8h");
        const callbackToken = signEditorToken({
          purpose: "onlyoffice-callback",
          fileId: resolved.file.id
        }, "8h");

        const lockResult = resolved.capabilities.canEdit
          ? await acquireFileLock({
              fileId: resolved.file.id,
              userId: request.requestUser.id
            })
          : { granted: false, lock: null, state: "DENIED" as const };

        const canEdit = resolved.capabilities.canEdit && lockResult.granted;
        const modeReason: EditorModeReason = canEdit
          ? lockResult.state === "RENEWED"
            ? "EDIT_LOCK_RENEWED"
            : "EDIT_LOCK_ACQUIRED"
          : resolved.capabilities.canEdit
            ? "LOCKED_BY_OTHER_USER"
            : "READ_ONLY_PERMISSION";
        const fileKey = createHash("sha256")
          .update(`${resolved.file.id}:${resolved.file.updatedAt}:${resolved.file.storageKey}`)
          .digest("hex")
          .slice(0, 64);

        const config = {
          document: {
            fileType,
            key: fileKey,
            title: resolved.file.name,
            url: `${env.API_INTERNAL_BASE_URL}/editor/files/${resolved.file.id}/content?token=${encodeURIComponent(accessToken)}`,
            permissions: {
              download: true,
              edit: canEdit
            }
          },
          documentType,
          editorConfig: {
            callbackUrl: `${env.API_INTERNAL_BASE_URL}/editor/files/${resolved.file.id}/callback?token=${encodeURIComponent(callbackToken)}`,
            mode: canEdit ? "edit" : "view",
            lang: "en",
            user: {
              id: request.requestUser.id,
              name: request.requestUser.displayName
            },
            customization: {
              forcesave: true
            }
          }
        };

        const token = signEditorToken(config);

        await createAuditEvent({
          actorUserId: request.requestUser.id,
          action: canEdit
            ? lockResult.state === "RENEWED"
              ? "onlyoffice_lock_renewed"
              : "onlyoffice_lock_acquired"
            : modeReason === "LOCKED_BY_OTHER_USER"
              ? "onlyoffice_opened_locked_view"
              : "onlyoffice_opened_read_only",
          entityType: "file",
          entityId: resolved.file.id,
          details: {
            mode: canEdit ? "edit" : "view",
            modeReason,
            lockOwnerUserId: lockResult.lock?.lockedByUserId ?? null
          }
        });

        return {
          documentServerUrl: onlyOfficePublicUrl(),
          config,
          token,
          lock: lockResult.lock,
          canEdit,
          mode: canEdit ? "edit" : "view",
          modeReason
        };
      } catch (error) {
        return reply.code(400).send({ message: (error as Error).message });
      }
    }
  );

  app.get(
    "/editor/files/:fileId/content",
    async (request, reply) => {
      const params = editorParamsSchema.parse(request.params);
      const query = z.object({
        token: z.string().min(1)
      }).parse(request.query);

      try {
        verifyEditorToken(query.token, "onlyoffice-content", params.fileId);

        const file = await findFileById(params.fileId);
        if (!file) {
          return reply.code(404).send({ message: "File not found." });
        }

        const content = await readBuffer(file.storageKey);
        reply.header("Content-Type", file.mimeType);
        reply.header("Content-Disposition", `inline; filename="${encodeURIComponent(file.originalName)}"`);
        return reply.send(content);
      } catch (error) {
        return reply.code(403).send({ message: (error as Error).message });
      }
    }
  );

  app.post(
    "/editor/files/:fileId/callback",
    async (request, reply) => {
      const params = editorParamsSchema.parse(request.params);
      const query = z.object({
        token: z.string().min(1)
      }).parse(request.query);
      const body = callbackBodySchema.parse(request.body);

      try {
        verifyEditorToken(query.token, "onlyoffice-callback", params.fileId);

        if ((body.status === 2 || body.status === 6) && body.url) {
          const response = await fetchOnlyOfficeCallbackContent(body.url);

          const arrayBuffer = await response.arrayBuffer();
          const file = await findFileById(params.fileId);
          if (!file) {
            throw new Error("File not found.");
          }

          const saved = await saveBuffer({
            fileName: file.originalName,
            content: Buffer.from(arrayBuffer)
          });

          const lastUserId = body.users?.[body.users.length - 1];
          const editorUser = lastUserId ? await findUserById(lastUserId) : null;

          await replaceFileContent({
            fileId: params.fileId,
            storageKey: saved.storageKey,
            originalName: file.originalName,
            mimeType: file.mimeType,
            sizeBytes: Number(response.headers.get("content-length") ?? arrayBuffer.byteLength),
            updatedByUserId: editorUser?.id ?? null
          });

          await createAuditEvent({
            actorUserId: editorUser?.id ?? null,
            action: "onlyoffice_saved",
            entityType: "file",
            entityId: params.fileId,
            details: {
              status: body.status
            }
          });
        }

        if (body.status === 2 || body.status === 4) {
          const releasedLock = await releaseFileLock(params.fileId);
          if (releasedLock) {
            const lastUserId = body.users?.[body.users.length - 1] ?? null;
            const editorUser = lastUserId ? await findUserById(lastUserId) : null;

            await createAuditEvent({
              actorUserId: editorUser?.id ?? null,
              action: "onlyoffice_lock_released",
              entityType: "file",
              entityId: params.fileId,
              details: {
                status: body.status,
                previousLockOwnerUserId: releasedLock.lockedByUserId
              }
            });
          }
        }

        return reply.send({ error: 0 });
      } catch (error) {
        return reply.code(400).send({ message: (error as Error).message });
      }
    }
  );

  app.post(
    "/editor/files/:fileId/force-unlock",
    {
      preHandler: requireAuth
    },
    async (request, reply) => {
      if (!request.requestUser) {
        return reply.code(401).send({ message: "Unauthorized." });
      }

      const params = editorParamsSchema.parse(request.params);

      try {
        await resolveTargetManageAccess({
          user: request.requestUser,
          targetType: "FILE",
          targetId: params.fileId
        });

        const released = await releaseFileLock(params.fileId);

        await createAuditEvent({
          actorUserId: request.requestUser.id,
          action: "file_force_unlocked",
          entityType: "file",
          entityId: params.fileId,
          details: {}
        });

        return {
          lock: released
        };
      } catch (error) {
        return reply.code(400).send({ message: (error as Error).message });
      }
    }
  );
}
