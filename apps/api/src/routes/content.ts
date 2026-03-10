import type { SearchResultSummary } from "@my-project/domain";
import { basename } from "node:path";
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth.js";
import {
  createAuditEvent,
  createFileRecord,
  createFileVersionSnapshot,
  createFolderRecord,
  deleteFileToRecycleBin,
  deleteFolderToRecycleBin,
  findFileById,
  findFolderById,
  findRecycleEntryById,
  findSpaceById,
  findUserByUsername,
  findPermissionGrantById,
  findUserById,
  getFolderAncestors,
  listAccessibleSpaces,
  listFileVersions,
  listFolderContents,
  listPermissionGrantsByTarget,
  listRecycleEntries,
  listSearchCandidateFiles,
  moveFileRecord,
  moveFolderRecord,
  renameFileRecord,
  renameFolderRecord,
  replaceFileContent,
  restoreRecycleEntry,
  restoreFileVersion,
  revokePermissionGrant,
  upsertPermissionGrant
} from "../db.js";
import {
  requireReadableSpace,
  resolveFileAccess,
  resolveFolderAccess,
  resolveTargetManageAccess
} from "../permissions.js";
import { deleteBuffer, readBuffer, saveBuffer } from "../storage.js";

const contentQuerySchema = z.object({
  folderId: z.string().uuid().nullable().optional()
});

const createFolderSchema = z.object({
  parentFolderId: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(120)
});

const shareSchema = z.object({
  targetType: z.enum(["FOLDER", "FILE"]),
  targetId: z.string().uuid(),
  granteeUserId: z.string().uuid(),
  accessLevel: z.enum(["READ", "EDIT"])
});

const renameSchema = z.object({
  name: z.string().min(1).max(120)
});

const moveSchema = z.object({
  targetFolderId: z.string().uuid().nullable()
});

const shareQuerySchema = z.object({
  targetType: z.enum(["FOLDER", "FILE"]),
  targetId: z.string().uuid()
});

const searchQuerySchema = z.object({
  fileName: z.string().trim().optional(),
  path: z.string().trim().optional(),
  uploaderUserId: z.string().uuid().optional(),
  updatedFrom: z.string().datetime().optional(),
  updatedTo: z.string().datetime().optional(),
  spaceId: z.string().uuid().optional()
});

const recycleQuerySchema = z.object({
  spaceId: z.string().uuid().optional()
});

const versionParamsSchema = z.object({
  fileId: z.string().uuid()
});

const restoreVersionParamsSchema = z.object({
  fileId: z.string().uuid(),
  versionId: z.string().uuid()
});

export async function registerContentRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/files/:fileId/versions",
    {
      preHandler: requireAuth
    },
    async (request, reply) => {
      if (!request.requestUser) {
        return reply.code(401).send({ message: "Unauthorized." });
      }

      const params = versionParamsSchema.parse(request.params);

      try {
        await resolveFileAccess({
          user: request.requestUser,
          fileId: params.fileId
        });

        return {
          versions: await listFileVersions(params.fileId)
        };
      } catch (error) {
        return reply.code(403).send({ message: (error as Error).message });
      }
    }
  );

  app.get(
    "/recycle-bin",
    {
      preHandler: requireAuth
    },
    async (request, reply) => {
      if (!request.requestUser) {
        return reply.code(401).send({ message: "Unauthorized." });
      }

      const query = recycleQuerySchema.parse(request.query);

      try {
        const user = await findUserByUsername(request.requestUser.username);
        if (!user) {
          return reply.code(404).send({ message: "User not found." });
        }

        const manageableSpaces = (await listAccessibleSpaces(user)).filter((space) => space.manageable);
        const targetSpaces = query.spaceId
          ? manageableSpaces.filter((space) => space.id === query.spaceId)
          : manageableSpaces;

        return {
          entries: await listRecycleEntries(targetSpaces.map((space) => space.id))
        };
      } catch (error) {
        return reply.code(400).send({ message: (error as Error).message });
      }
    }
  );

  app.get(
    "/search/files",
    {
      preHandler: requireAuth
    },
    async (request, reply) => {
      if (!request.requestUser) {
        return reply.code(401).send({ message: "Unauthorized." });
      }

      const query = searchQuerySchema.parse(request.query);

      try {
        const user = await findUserByUsername(request.requestUser.username);
        if (!user) {
          return reply.code(404).send({ message: "User not found." });
        }

        const accessibleSpaces = await listAccessibleSpaces(user);
        const filteredSpaces = query.spaceId
          ? accessibleSpaces.filter((space) => space.id === query.spaceId)
          : accessibleSpaces;

        const spaceMap = new Map(filteredSpaces.map((space) => [space.id, space] as const));
        const searchInput: Parameters<typeof listSearchCandidateFiles>[0] = {
          spaceIds: [...spaceMap.keys()]
        };
        if (query.fileName) {
          searchInput.nameQuery = query.fileName;
        }
        if (query.uploaderUserId) {
          searchInput.uploaderUserId = query.uploaderUserId;
        }
        if (query.updatedFrom) {
          searchInput.updatedFrom = query.updatedFrom;
        }
        if (query.updatedTo) {
          searchInput.updatedTo = query.updatedTo;
        }

        const candidates = await listSearchCandidateFiles(searchInput);

        const results: SearchResultSummary[] = [];
        const pathQuery = query.path?.toLowerCase();

        for (const candidate of candidates) {
          let resolved;
          try {
            resolved = await resolveFileAccess({
              user: request.requestUser,
              fileId: candidate.id
            });
          } catch {
            continue;
          }

          const space = spaceMap.get(resolved.space.id) ?? (await findSpaceById(resolved.space.id));
          if (!space) {
            continue;
          }

          const folderPath = resolved.file.folderId
            ? (await getFolderAncestors(resolved.file.folderId)).map((entry) => entry.name)
            : [];
          const path = [space.name, ...folderPath, resolved.file.name].join(" / ");

          if (pathQuery && !path.toLowerCase().includes(pathQuery)) {
            continue;
          }

          results.push({
            file: resolved.file,
            path,
            space
          });
        }

        return {
          results
        };
      } catch (error) {
        return reply.code(400).send({ message: (error as Error).message });
      }
    }
  );

  app.get(
    "/spaces/:spaceId/contents",
    {
      preHandler: requireAuth
    },
    async (request, reply) => {
      if (!request.requestUser) {
        return reply.code(401).send({
          message: "Unauthorized."
        });
      }

      const params = z.object({
        spaceId: z.string().uuid()
      }).parse(request.params);
      const query = contentQuerySchema.parse(request.query);

      try {
        if (query.folderId) {
          const resolved = await resolveFolderAccess({
            user: request.requestUser,
            spaceId: params.spaceId,
            folderId: query.folderId
          });
          const content = await listFolderContents({
            spaceId: params.spaceId,
            parentFolderId: query.folderId
          });
          return {
            space: resolved.space,
            currentFolder: resolved.folder,
            breadcrumbs: resolved.folderChain,
            permissions: resolved.capabilities,
            folders: content.folders,
            files: content.files
          };
        }

        const resolved = await requireReadableSpace(request.requestUser, params.spaceId);
        const content = await listFolderContents({
          spaceId: params.spaceId,
          parentFolderId: null
        });
        return {
          space: resolved.space,
          currentFolder: null,
          breadcrumbs: [],
          permissions: resolved.capabilities,
          folders: content.folders,
          files: content.files
        };
      } catch (error) {
        return reply.code(403).send({
          message: (error as Error).message
        });
      }
    }
  );

  app.post(
    "/spaces/:spaceId/folders",
    {
      preHandler: requireAuth
    },
    async (request, reply) => {
      if (!request.requestUser) {
        return reply.code(401).send({
          message: "Unauthorized."
        });
      }

      const params = z.object({
        spaceId: z.string().uuid()
      }).parse(request.params);
      const body = createFolderSchema.parse(request.body);

      try {
        let permissions;
        if (body.parentFolderId) {
          const resolved = await resolveFolderAccess({
            user: request.requestUser,
            spaceId: params.spaceId,
            folderId: body.parentFolderId
          });
          permissions = resolved.capabilities;
        } else {
          permissions = (await requireReadableSpace(request.requestUser, params.spaceId)).capabilities;
        }

        if (!permissions.canEdit) {
          return reply.code(403).send({
            message: "You do not have permission to create folders here."
          });
        }

        const folder = await createFolderRecord({
          spaceId: params.spaceId,
          parentFolderId: body.parentFolderId ?? null,
          name: body.name.trim(),
          createdByUserId: request.requestUser.id
        });

        await createAuditEvent({
          actorUserId: request.requestUser.id,
          action: "folder_created",
          entityType: "folder",
          entityId: folder.id,
          details: {
            spaceId: folder.spaceId,
            parentFolderId: folder.parentFolderId,
            name: folder.name
          }
        });

        return reply.code(201).send({
          folder
        });
      } catch (error) {
        return reply.code(400).send({
          message: (error as Error).message
        });
      }
    }
  );

  app.patch(
    "/folders/:folderId/rename",
    {
      preHandler: requireAuth
    },
    async (request, reply) => {
      if (!request.requestUser) {
        return reply.code(401).send({ message: "Unauthorized." });
      }

      const params = z.object({ folderId: z.string().uuid() }).parse(request.params);
      const body = renameSchema.parse(request.body);

      try {
        const folder = await findFolderById(params.folderId);
        if (!folder) {
          return reply.code(404).send({ message: "Folder not found." });
        }

        const resolved = await resolveFolderAccess({
          user: request.requestUser,
          spaceId: folder.spaceId,
          folderId: folder.id
        });

        if (!resolved.capabilities.canEdit) {
          return reply.code(403).send({ message: "You do not have permission to rename this folder." });
        }

        const renamed = await renameFolderRecord(folder.id, body.name.trim());
        await createAuditEvent({
          actorUserId: request.requestUser.id,
          action: "folder_renamed",
          entityType: "folder",
          entityId: renamed.id,
          details: {
            from: folder.name,
            to: renamed.name
          }
        });

        return { folder: renamed };
      } catch (error) {
        return reply.code(400).send({ message: (error as Error).message });
      }
    }
  );

  app.patch(
    "/folders/:folderId/move",
    {
      preHandler: requireAuth
    },
    async (request, reply) => {
      if (!request.requestUser) {
        return reply.code(401).send({ message: "Unauthorized." });
      }

      const params = z.object({ folderId: z.string().uuid() }).parse(request.params);
      const body = moveSchema.parse(request.body);

      try {
        const folder = await findFolderById(params.folderId);
        if (!folder) {
          return reply.code(404).send({ message: "Folder not found." });
        }

        const source = await resolveFolderAccess({
          user: request.requestUser,
          spaceId: folder.spaceId,
          folderId: folder.id
        });
        if (!source.capabilities.canEdit) {
          return reply.code(403).send({ message: "You do not have permission to move this folder." });
        }

        if (body.targetFolderId === folder.id) {
          return reply.code(400).send({ message: "A folder cannot be moved into itself." });
        }

        if (body.targetFolderId) {
          const target = await resolveFolderAccess({
            user: request.requestUser,
            spaceId: folder.spaceId,
            folderId: body.targetFolderId
          });
          if (!target.capabilities.canEdit) {
            return reply.code(403).send({ message: "You do not have permission to move into the target folder." });
          }
          if (target.folderChain.some((entry) => entry.id === folder.id)) {
            return reply.code(400).send({ message: "A folder cannot be moved into its own descendant." });
          }
        } else {
          const root = await requireReadableSpace(request.requestUser, folder.spaceId);
          if (!root.capabilities.canEdit) {
            return reply.code(403).send({ message: "You do not have permission to move this folder to root." });
          }
        }

        const moved = await moveFolderRecord(folder.id, body.targetFolderId ?? null);
        await createAuditEvent({
          actorUserId: request.requestUser.id,
          action: "folder_moved",
          entityType: "folder",
          entityId: moved.id,
          details: {
            fromParentFolderId: folder.parentFolderId,
            toParentFolderId: moved.parentFolderId
          }
        });

        return { folder: moved };
      } catch (error) {
        return reply.code(400).send({ message: (error as Error).message });
      }
    }
  );

  app.post(
    "/spaces/:spaceId/files/upload",
    {
      preHandler: requireAuth
    },
    async (request, reply) => {
      if (!request.requestUser) {
        return reply.code(401).send({
          message: "Unauthorized."
        });
      }

      const params = z.object({
        spaceId: z.string().uuid()
      }).parse(request.params);

      let folderId: string | null = null;
      let fileName = "";
      let mimeType = "application/octet-stream";
      let buffer: Buffer | null = null;

      try {
        for await (const part of request.parts()) {
          if (part.type === "file") {
            fileName = part.filename;
            mimeType = part.mimetype;
            buffer = await part.toBuffer();
          } else if (part.fieldname === "folderId" && typeof part.value === "string" && part.value.length > 0) {
            folderId = part.value;
          }
        }

        if (!buffer || !fileName) {
          return reply.code(400).send({
            message: "A file is required."
          });
        }

        let permissions;
        if (folderId) {
          const resolved = await resolveFolderAccess({
            user: request.requestUser,
            spaceId: params.spaceId,
            folderId
          });
          permissions = resolved.capabilities;
        } else {
          permissions = (await requireReadableSpace(request.requestUser, params.spaceId)).capabilities;
        }

        if (!permissions.canEdit) {
          return reply.code(403).send({
            message: "You do not have permission to upload files here."
          });
        }

        const saved = await saveBuffer({
          fileName,
          content: buffer
        });

        try {
          const file = await createFileRecord({
            spaceId: params.spaceId,
            folderId,
            name: basename(fileName),
            originalName: fileName,
            mimeType,
            sizeBytes: buffer.length,
            storageKey: saved.storageKey,
            createdByUserId: request.requestUser.id
          });

          await createAuditEvent({
            actorUserId: request.requestUser.id,
            action: "file_uploaded",
            entityType: "file",
            entityId: file.id,
            details: {
              spaceId: file.spaceId,
              folderId: file.folderId,
              name: file.name,
              sizeBytes: file.sizeBytes
            }
          });

          return reply.code(201).send({
            file
          });
        } catch (error) {
          await deleteBuffer(saved.storageKey);
          throw error;
        }
      } catch (error) {
        return reply.code(400).send({
          message: (error as Error).message
        });
      }
    }
  );

  app.post(
    "/files/:fileId/replace",
    {
      preHandler: requireAuth
    },
    async (request, reply) => {
      if (!request.requestUser) {
        return reply.code(401).send({ message: "Unauthorized." });
      }

      const params = versionParamsSchema.parse(request.params);
      let fileName = "";
      let mimeType = "application/octet-stream";
      let buffer: Buffer | null = null;

      try {
        const resolved = await resolveFileAccess({
          user: request.requestUser,
          fileId: params.fileId
        });

        if (!resolved.capabilities.canEdit) {
          return reply.code(403).send({ message: "You do not have permission to replace this file." });
        }

        for await (const part of request.parts()) {
          if (part.type === "file") {
            fileName = part.filename;
            mimeType = part.mimetype;
            buffer = await part.toBuffer();
          }
        }

        if (!buffer || !fileName) {
          return reply.code(400).send({ message: "A replacement file is required." });
        }

        const saved = await saveBuffer({
          fileName,
          content: buffer
        });

        try {
          const file = await replaceFileContent({
            fileId: resolved.file.id,
            storageKey: saved.storageKey,
            originalName: fileName,
            mimeType,
            sizeBytes: buffer.length,
            updatedByUserId: request.requestUser.id
          });

          await createAuditEvent({
            actorUserId: request.requestUser.id,
            action: "file_content_replaced",
            entityType: "file",
            entityId: file.id,
            details: {
              spaceId: file.spaceId,
              originalName: file.originalName,
              sizeBytes: file.sizeBytes
            }
          });

          return { file };
        } catch (error) {
          await deleteBuffer(saved.storageKey);
          throw error;
        }
      } catch (error) {
        return reply.code(400).send({ message: (error as Error).message });
      }
    }
  );

  app.post(
    "/folders/:folderId/delete",
    {
      preHandler: requireAuth
    },
    async (request, reply) => {
      if (!request.requestUser) {
        return reply.code(401).send({ message: "Unauthorized." });
      }

      const params = z.object({ folderId: z.string().uuid() }).parse(request.params);

      try {
        const folder = await findFolderById(params.folderId);
        if (!folder) {
          return reply.code(404).send({ message: "Folder not found." });
        }

        const resolved = await resolveTargetManageAccess({
          user: request.requestUser,
          targetType: "FOLDER",
          targetId: folder.id
        });

        if (!resolved.capabilities.canManage) {
          return reply.code(403).send({ message: "You do not have permission to delete this folder." });
        }

        const entry = await deleteFolderToRecycleBin({
          folderId: folder.id,
          deletedByUserId: request.requestUser.id
        });

        await createAuditEvent({
          actorUserId: request.requestUser.id,
          action: "folder_deleted_to_recycle_bin",
          entityType: "folder",
          entityId: folder.id,
          details: {
            spaceId: folder.spaceId,
            name: folder.name
          }
        });

        return { entry };
      } catch (error) {
        return reply.code(400).send({ message: (error as Error).message });
      }
    }
  );

  app.post(
    "/files/:fileId/delete",
    {
      preHandler: requireAuth
    },
    async (request, reply) => {
      if (!request.requestUser) {
        return reply.code(401).send({ message: "Unauthorized." });
      }

      const params = z.object({ fileId: z.string().uuid() }).parse(request.params);

      try {
        const file = await findFileById(params.fileId);
        if (!file) {
          return reply.code(404).send({ message: "File not found." });
        }

        const resolved = await resolveTargetManageAccess({
          user: request.requestUser,
          targetType: "FILE",
          targetId: file.id
        });

        if (!resolved.capabilities.canManage) {
          return reply.code(403).send({ message: "You do not have permission to delete this file." });
        }

        const entry = await deleteFileToRecycleBin({
          fileId: file.id,
          deletedByUserId: request.requestUser.id
        });

        await createAuditEvent({
          actorUserId: request.requestUser.id,
          action: "file_deleted_to_recycle_bin",
          entityType: "file",
          entityId: file.id,
          details: {
            spaceId: file.spaceId,
            name: file.name
          }
        });

        return { entry };
      } catch (error) {
        return reply.code(400).send({ message: (error as Error).message });
      }
    }
  );

  app.post(
    "/recycle-bin/:entryId/restore",
    {
      preHandler: requireAuth
    },
    async (request, reply) => {
      if (!request.requestUser) {
        return reply.code(401).send({ message: "Unauthorized." });
      }

      const params = z.object({ entryId: z.string().uuid() }).parse(request.params);

      try {
        const entry = await findRecycleEntryById(params.entryId);
        if (!entry) {
          return reply.code(404).send({ message: "Recycle entry not found." });
        }

        const readable = await requireReadableSpace(request.requestUser, entry.spaceId);
        if (!readable.capabilities.canManage) {
          return reply.code(403).send({ message: "You do not have permission to restore this item." });
        }

        const restored = await restoreRecycleEntry(entry.id);
        await createAuditEvent({
          actorUserId: request.requestUser.id,
          action: "recycle_bin_restored",
          entityType: restored.targetType.toLowerCase(),
          entityId: restored.targetId,
          details: {
            spaceId: restored.spaceId,
            originalName: restored.originalName
          }
        });

        return { entry: restored };
      } catch (error) {
        return reply.code(400).send({ message: (error as Error).message });
      }
    }
  );

  app.post(
    "/files/:fileId/versions/:versionId/restore",
    {
      preHandler: requireAuth
    },
    async (request, reply) => {
      if (!request.requestUser) {
        return reply.code(401).send({ message: "Unauthorized." });
      }

      const params = restoreVersionParamsSchema.parse(request.params);

      try {
        const resolved = await resolveFileAccess({
          user: request.requestUser,
          fileId: params.fileId
        });

        if (!resolved.capabilities.canEdit) {
          return reply.code(403).send({ message: "You do not have permission to restore this version." });
        }

        const file = await restoreFileVersion({
          fileId: params.fileId,
          versionId: params.versionId,
          updatedByUserId: request.requestUser.id
        });

        await createAuditEvent({
          actorUserId: request.requestUser.id,
          action: "file_version_restored",
          entityType: "file",
          entityId: file.id,
          details: {
            versionId: params.versionId
          }
        });

        return { file };
      } catch (error) {
        return reply.code(400).send({ message: (error as Error).message });
      }
    }
  );

  app.get(
    "/files/:fileId/download",
    {
      preHandler: requireAuth
    },
    async (request, reply) => {
      if (!request.requestUser) {
        return reply.code(401).send({
          message: "Unauthorized."
        });
      }

      const params = z.object({
        fileId: z.string().uuid()
      }).parse(request.params);

      try {
        const resolved = await resolveFileAccess({
          user: request.requestUser,
          fileId: params.fileId
        });
        const content = await readBuffer(resolved.file.storageKey);

        await createAuditEvent({
          actorUserId: request.requestUser.id,
          action: "file_downloaded",
          entityType: "file",
          entityId: resolved.file.id,
          details: {
            spaceId: resolved.file.spaceId,
            folderId: resolved.file.folderId
          }
        });

        reply.header(
          "Content-Disposition",
          `attachment; filename="${encodeURIComponent(resolved.file.originalName)}"`
        );
        reply.header("Content-Type", resolved.file.mimeType);
        return reply.send(content);
      } catch (error) {
        return reply.code(403).send({
          message: (error as Error).message
        });
      }
    }
  );

  app.patch(
    "/files/:fileId/rename",
    {
      preHandler: requireAuth
    },
    async (request, reply) => {
      if (!request.requestUser) {
        return reply.code(401).send({ message: "Unauthorized." });
      }

      const params = z.object({ fileId: z.string().uuid() }).parse(request.params);
      const body = renameSchema.parse(request.body);

      try {
        const resolved = await resolveFileAccess({
          user: request.requestUser,
          fileId: params.fileId
        });

        if (!resolved.capabilities.canEdit) {
          return reply.code(403).send({ message: "You do not have permission to rename this file." });
        }

        const renamed = await renameFileRecord(params.fileId, body.name.trim());
        await createAuditEvent({
          actorUserId: request.requestUser.id,
          action: "file_renamed",
          entityType: "file",
          entityId: renamed.id,
          details: {
            from: resolved.file.name,
            to: renamed.name
          }
        });

        return { file: renamed };
      } catch (error) {
        return reply.code(400).send({ message: (error as Error).message });
      }
    }
  );

  app.patch(
    "/files/:fileId/move",
    {
      preHandler: requireAuth
    },
    async (request, reply) => {
      if (!request.requestUser) {
        return reply.code(401).send({ message: "Unauthorized." });
      }

      const params = z.object({ fileId: z.string().uuid() }).parse(request.params);
      const body = moveSchema.parse(request.body);

      try {
        const resolved = await resolveFileAccess({
          user: request.requestUser,
          fileId: params.fileId
        });

        if (!resolved.capabilities.canEdit) {
          return reply.code(403).send({ message: "You do not have permission to move this file." });
        }

        if (body.targetFolderId) {
          const target = await resolveFolderAccess({
            user: request.requestUser,
            spaceId: resolved.space.id,
            folderId: body.targetFolderId
          });
          if (!target.capabilities.canEdit) {
            return reply.code(403).send({ message: "You do not have permission to move into the target folder." });
          }
        } else {
          const root = await requireReadableSpace(request.requestUser, resolved.space.id);
          if (!root.capabilities.canEdit) {
            return reply.code(403).send({ message: "You do not have permission to move this file to root." });
          }
        }

        const moved = await moveFileRecord(params.fileId, body.targetFolderId ?? null);
        await createAuditEvent({
          actorUserId: request.requestUser.id,
          action: "file_moved",
          entityType: "file",
          entityId: moved.id,
          details: {
            fromFolderId: resolved.file.folderId,
            toFolderId: moved.folderId
          }
        });

        return { file: moved };
      } catch (error) {
        return reply.code(400).send({ message: (error as Error).message });
      }
    }
  );

  app.get(
    "/shares",
    {
      preHandler: requireAuth
    },
    async (request, reply) => {
      if (!request.requestUser) {
        return reply.code(401).send({ message: "Unauthorized." });
      }

      const query = shareQuerySchema.parse(request.query);

      try {
        await resolveTargetManageAccess({
          user: request.requestUser,
          targetType: query.targetType,
          targetId: query.targetId
        });

        return {
          grants: await listPermissionGrantsByTarget({
            targetType: query.targetType,
            targetId: query.targetId
          })
        };
      } catch (error) {
        return reply.code(403).send({ message: (error as Error).message });
      }
    }
  );

  app.post(
    "/shares",
    {
      preHandler: requireAuth
    },
    async (request, reply) => {
      if (!request.requestUser) {
        return reply.code(401).send({
          message: "Unauthorized."
        });
      }

      const body = shareSchema.parse(request.body);

      try {
        await resolveTargetManageAccess({
          user: request.requestUser,
          targetType: body.targetType,
          targetId: body.targetId
        });

        const grantee = await findUserById(body.granteeUserId);
        if (!grantee) {
          return reply.code(404).send({
            message: "Grantee user not found."
          });
        }

        if (grantee.id === request.requestUser.id) {
          return reply.code(400).send({
            message: "Sharing with yourself is not allowed."
          });
        }

        if (body.targetType === "FOLDER") {
          const folder = await findFolderById(body.targetId);
          if (!folder) {
            return reply.code(404).send({
              message: "Folder not found."
            });
          }
        }

        const grant = await upsertPermissionGrant({
          targetType: body.targetType,
          targetId: body.targetId,
          granteeUserId: body.granteeUserId,
          accessLevel: body.accessLevel,
          grantedByUserId: request.requestUser.id
        });

        await createAuditEvent({
          actorUserId: request.requestUser.id,
          action: "permission_granted",
          entityType: body.targetType.toLowerCase(),
          entityId: body.targetId,
          details: {
            granteeUserId: body.granteeUserId,
            accessLevel: body.accessLevel
          }
        });

        return reply.code(201).send({
          grant
        });
      } catch (error) {
        return reply.code(403).send({
          message: (error as Error).message
        });
      }
    }
  );

  app.delete(
    "/shares/:grantId",
    {
      preHandler: requireAuth
    },
    async (request, reply) => {
      if (!request.requestUser) {
        return reply.code(401).send({ message: "Unauthorized." });
      }

      const params = z.object({
        grantId: z.string().uuid()
      }).parse(request.params);

      try {
        const grant = await findPermissionGrantById(params.grantId);
        if (!grant) {
          return reply.code(404).send({ message: "Share grant not found." });
        }

        if (grant.targetType === "SPACE") {
          return reply.code(400).send({ message: "Space-level grants are not managed by this endpoint." });
        }

        await resolveTargetManageAccess({
          user: request.requestUser,
          targetType: grant.targetType,
          targetId: grant.targetId
        });

        const revoked = await revokePermissionGrant(params.grantId);
        if (!revoked) {
          return reply.code(404).send({ message: "Share grant not found." });
        }

        await createAuditEvent({
          actorUserId: request.requestUser.id,
          action: "permission_revoked",
          entityType: revoked.targetType.toLowerCase(),
          entityId: revoked.targetId,
          details: {
            granteeUserId: revoked.granteeUserId
          }
        });

        return {
          grant: revoked
        };
      } catch (error) {
        return reply.code(403).send({ message: (error as Error).message });
      }
    }
  );
}
