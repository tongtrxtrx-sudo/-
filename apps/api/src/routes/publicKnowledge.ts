import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth.js";
import {
  createAuditEvent,
  createFileRecord,
  createKnowledgeEntry,
  findFileById,
  findPublicKnowledgeSpace,
  listKnowledgeEntries,
  listPublicKnowledgeCategories,
  updateKnowledgeEntry
} from "../db.js";
import { resolveFileAccess } from "../permissions.js";
import { readBuffer, saveBuffer } from "../storage.js";

const publishSchema = z.object({
  sourceFileId: z.string().uuid(),
  categoryFolderId: z.string().uuid(),
  ownerDepartmentId: z.string().uuid().nullable(),
  maintainerUserId: z.string().uuid().nullable(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("PUBLISHED"),
  effectiveDate: z.string().date().nullable().optional()
});

const updateEntrySchema = z.object({
  ownerDepartmentId: z.string().uuid().nullable(),
  maintainerUserId: z.string().uuid().nullable(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  effectiveDate: z.string().date().nullable()
});

function canPublish(role: string): boolean {
  return role === "SUPER_ADMIN" || role === "DEPARTMENT_MANAGER";
}

export async function registerPublicKnowledgeRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/public-knowledge/categories",
    {
      preHandler: requireAuth
    },
    async (request, reply) => {
      if (!request.requestUser) {
        return reply.code(401).send({ message: "Unauthorized." });
      }

      return {
        categories: await listPublicKnowledgeCategories()
      };
    }
  );

  app.get(
    "/public-knowledge/entries",
    {
      preHandler: requireAuth
    },
    async (request, reply) => {
      if (!request.requestUser) {
        return reply.code(401).send({ message: "Unauthorized." });
      }

      return {
        entries: await listKnowledgeEntries()
      };
    }
  );

  app.post(
    "/public-knowledge/publish",
    {
      preHandler: requireAuth
    },
    async (request, reply) => {
      if (!request.requestUser) {
        return reply.code(401).send({ message: "Unauthorized." });
      }

      if (!canPublish(request.requestUser.role)) {
        return reply.code(403).send({ message: "Publishing requires super admin or department manager access." });
      }

      const body = publishSchema.parse(request.body);

      try {
        const resolved = await resolveFileAccess({
          user: request.requestUser,
          fileId: body.sourceFileId
        });
        const publicSpace = await findPublicKnowledgeSpace();
        const sourceFile = await findFileById(body.sourceFileId);
        if (!sourceFile) {
          return reply.code(404).send({ message: "Source file not found." });
        }

        const content = await readBuffer(sourceFile.storageKey);
        const saved = await saveBuffer({
          fileName: sourceFile.originalName,
          content
        });

        const publishedFile = await createFileRecord({
          spaceId: publicSpace.id,
          folderId: body.categoryFolderId,
          name: resolved.file.name,
          originalName: sourceFile.originalName,
          mimeType: sourceFile.mimeType,
          sizeBytes: sourceFile.sizeBytes,
          storageKey: saved.storageKey,
          createdByUserId: request.requestUser.id
        });

        const entry = await createKnowledgeEntry({
          fileId: publishedFile.id,
          categoryFolderId: body.categoryFolderId,
          ownerDepartmentId: body.ownerDepartmentId ?? request.requestUser.departmentId,
          maintainerUserId: body.maintainerUserId ?? request.requestUser.id,
          status: body.status,
          effectiveDate: body.effectiveDate ?? null,
          publishedByUserId: request.requestUser.id
        });

        await createAuditEvent({
          actorUserId: request.requestUser.id,
          action: "public_knowledge_published",
          entityType: "knowledge_entry",
          entityId: entry.id,
          details: {
            sourceFileId: body.sourceFileId,
            publishedFileId: publishedFile.id,
            categoryFolderId: body.categoryFolderId,
            status: entry.status
          }
        });

        return reply.code(201).send({
          file: publishedFile,
          entry
        });
      } catch (error) {
        return reply.code(400).send({ message: (error as Error).message });
      }
    }
  );

  app.patch(
    "/public-knowledge/entries/:entryId",
    {
      preHandler: requireAuth
    },
    async (request, reply) => {
      if (!request.requestUser) {
        return reply.code(401).send({ message: "Unauthorized." });
      }

      if (!canPublish(request.requestUser.role)) {
        return reply.code(403).send({ message: "Updating public knowledge metadata requires super admin or department manager access." });
      }

      const params = z.object({
        entryId: z.string().uuid()
      }).parse(request.params);
      const body = updateEntrySchema.parse(request.body);

      try {
        const entry = await updateKnowledgeEntry({
          entryId: params.entryId,
          ownerDepartmentId: body.ownerDepartmentId,
          maintainerUserId: body.maintainerUserId,
          status: body.status,
          effectiveDate: body.effectiveDate,
          publishedByUserId: request.requestUser.id
        });

        await createAuditEvent({
          actorUserId: request.requestUser.id,
          action: "public_knowledge_updated",
          entityType: "knowledge_entry",
          entityId: entry.id,
          details: {
            status: entry.status,
            effectiveDate: entry.effectiveDate
          }
        });

        return { entry };
      } catch (error) {
        return reply.code(400).send({ message: (error as Error).message });
      }
    }
  );
}
