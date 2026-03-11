import type { FastifyBaseLogger } from "fastify";
import { env } from "./config.js";
import {
  claimNextEditorCallbackJob,
  completeEditorCallbackJob,
  createAuditEvent,
  findFileById,
  findUserById,
  replaceFileContent,
  rescheduleEditorCallbackJob
} from "./db.js";
import type { EditorCallbackJobRecord } from "./types.js";
import { saveBuffer } from "./storage.js";

type Logger = Pick<FastifyBaseLogger, "info" | "warn" | "error">;

function onlyOfficeInternalUrl(): string {
  const internalUrl = env.ONLYOFFICE_DOCUMENT_SERVER_INTERNAL_URL ?? env.ONLYOFFICE_DOCUMENT_SERVER_URL;
  if (!internalUrl) {
    throw new Error("ONLYOFFICE document server is not configured.");
  }

  return internalUrl;
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

export function ensureAllowedOnlyOfficeCallbackUrl(callbackUrl: string): void {
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
  const response = await fetch(normalizedUrl, {
    signal: AbortSignal.timeout(15000)
  });

  if (!response.ok) {
    throw new Error(`ONLYOFFICE callback download returned status ${response.status}.`);
  }

  return response;
}

async function processEditorCallbackJob(job: EditorCallbackJobRecord, logger: Logger): Promise<void> {
  try {
    const response = await fetchOnlyOfficeCallbackContent(job.callbackUrl);
    const arrayBuffer = await response.arrayBuffer();
    const file = await findFileById(job.fileId);
    if (!file) {
      throw new Error("File not found.");
    }

    const saved = await saveBuffer({
      fileName: file.originalName,
      content: Buffer.from(arrayBuffer)
    });

    const lastUserId = job.callbackUsers.at(-1) ?? null;
    const editorUser = lastUserId ? await findUserById(lastUserId) : null;

    await replaceFileContent({
      fileId: job.fileId,
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
      entityId: job.fileId,
      details: {
        status: job.callbackStatus,
        callbackJobId: job.id,
        attempts: job.attempts
      }
    });

    await completeEditorCallbackJob(job.id);
  } catch (error) {
    const message = (error as Error).message;
    logger.warn(
      {
        jobId: job.id,
        fileId: job.fileId,
        attempts: job.attempts,
        error
      },
      "ONLYOFFICE callback job failed. Rescheduling."
    );

    await rescheduleEditorCallbackJob({
      jobId: job.id,
      attempts: job.attempts,
      lastError: message
    });

    if (job.attempts >= 12) {
      await createAuditEvent({
        actorUserId: null,
        action: "onlyoffice_save_failed",
        entityType: "file",
        entityId: job.fileId,
        details: {
          callbackJobId: job.id,
          attempts: job.attempts,
          error: message
        }
      });
    }
  }
}

export function startEditorCallbackProcessor(logger: Logger): () => void {
  let running = false;

  const tick = async (): Promise<void> => {
    if (running) {
      return;
    }

    running = true;
    try {
      for (let processed = 0; processed < 5; processed += 1) {
        const job = await claimNextEditorCallbackJob();
        if (!job) {
          break;
        }

        await processEditorCallbackJob(job, logger);
      }
    } catch (error) {
      logger.error({ error }, "Editor callback processor tick failed.");
    } finally {
      running = false;
    }
  };

  const timer = setInterval(() => {
    void tick();
  }, 5000);

  void tick();

  return () => {
    clearInterval(timer);
  };
}
