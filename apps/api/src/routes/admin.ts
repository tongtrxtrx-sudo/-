import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { hashPassword, requireSuperAdmin } from "../auth.js";
import { createAuditEvent, createDepartment, createUser, listAuditEvents, listDepartments, listUsers, resetUserPassword } from "../db.js";
import { listExpiredRecycleCandidates, listPrunableVersionCandidates, runRetentionJob } from "../maintenance.js";
import { listPublicKnowledgeCategories } from "../db.js";
import { env } from "../config.js";

const departmentSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2).max(20).regex(/^[A-Z0-9_-]+$/)
});

const userSchema = z.object({
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9._-]+$/),
  displayName: z.string().min(2),
  role: z.enum(["SUPER_ADMIN", "DEPARTMENT_MANAGER", "USER"]),
  departmentId: z.string().uuid().nullable(),
  initialPassword: z.string().min(12)
});

const resetSchema = z.object({
  newPassword: z.string().min(12)
});

const maintenanceRunSchema = z.object({
  job: z.enum(["recycle_cleanup", "version_prune", "quota_refresh", "all"]),
  dryRun: z.boolean().default(true)
});

async function getOnlyOfficeStatus(): Promise<{
  configured: boolean;
  documentServerUrl: string | null;
  internalDocumentServerUrl: string | null;
  apiPublicBaseUrl: string;
  apiInternalBaseUrl: string;
  jwtConfigured: boolean;
  supportedExtensions: string[];
  reachable: boolean;
  message: string;
}> {
  const documentServerUrl = env.ONLYOFFICE_DOCUMENT_SERVER_URL ?? null;
  const internalDocumentServerUrl =
    env.ONLYOFFICE_DOCUMENT_SERVER_INTERNAL_URL ?? env.ONLYOFFICE_DOCUMENT_SERVER_URL ?? null;
  const apiPublicBaseUrl = env.API_PUBLIC_BASE_URL;
  const apiInternalBaseUrl = env.API_INTERNAL_BASE_URL;
  const jwtConfigured = Boolean(env.ONLYOFFICE_JWT_SECRET?.trim());

  if (!documentServerUrl) {
    return {
      configured: false,
      documentServerUrl: null,
      internalDocumentServerUrl,
      apiPublicBaseUrl,
      apiInternalBaseUrl,
      jwtConfigured,
      supportedExtensions: ["docx", "xlsx", "pptx"],
      reachable: false,
      message: "ONLYOFFICE document server URL is not configured."
    };
  }

  try {
    const response = await fetch(`${internalDocumentServerUrl ?? documentServerUrl}/web-apps/apps/api/documents/api.js`, {
      method: "HEAD"
    });

    return {
      configured: true,
      documentServerUrl,
      internalDocumentServerUrl,
      apiPublicBaseUrl,
      apiInternalBaseUrl,
      jwtConfigured,
      supportedExtensions: ["docx", "xlsx", "pptx"],
      reachable: response.ok,
      message: response.ok
        ? "ONLYOFFICE document server is reachable from the API container."
        : `ONLYOFFICE document server responded with status ${response.status} when checked from the API container.`
    };
  } catch (error) {
    return {
      configured: true,
      documentServerUrl,
      internalDocumentServerUrl,
      apiPublicBaseUrl,
      apiInternalBaseUrl,
      jwtConfigured,
      supportedExtensions: ["docx", "xlsx", "pptx"],
      reachable: false,
      message: `ONLYOFFICE document server check failed from the API container: ${(error as Error).message}`
    };
  }
}

export async function registerAdminRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/admin/users",
    {
      preHandler: requireSuperAdmin
    },
    async () => ({
      users: await listUsers()
    })
  );

  app.get(
    "/admin/departments",
    {
      preHandler: requireSuperAdmin
    },
    async () => ({
      departments: await listDepartments()
    })
  );

  app.post(
    "/admin/departments",
    {
      preHandler: requireSuperAdmin
    },
    async (request, reply) => {
      const body = departmentSchema.parse(request.body);
      const department = await createDepartment(body.name, body.code);

      await createAuditEvent({
        actorUserId: request.requestUser?.id ?? null,
        action: "department_created",
        entityType: "department",
        entityId: department.id,
        details: {
          name: department.name,
          code: department.code
        }
      });

      return reply.code(201).send({
        department
      });
    }
  );

  app.post(
    "/admin/users",
    {
      preHandler: requireSuperAdmin
    },
    async (request, reply) => {
      const body = userSchema.parse(request.body);
      const user = await createUser({
        username: body.username,
        displayName: body.displayName,
        role: body.role,
        departmentId: body.departmentId,
        passwordHash: await hashPassword(body.initialPassword)
      });

      await createAuditEvent({
        actorUserId: request.requestUser?.id ?? null,
        action: "user_created",
        entityType: "user",
        entityId: user.id,
        details: {
          username: user.username,
          role: user.role,
          departmentId: user.departmentId
        }
      });

      return reply.code(201).send({
        user
      });
    }
  );

  app.post(
    "/admin/users/:userId/reset-password",
    {
      preHandler: requireSuperAdmin
    },
    async (request, reply) => {
      const params = z.object({
        userId: z.string().uuid()
      }).parse(request.params);
      const body = resetSchema.parse(request.body);

      const user = await resetUserPassword(params.userId, await hashPassword(body.newPassword));
      if (!user) {
        return reply.code(404).send({
          message: "User not found."
        });
      }

      await createAuditEvent({
        actorUserId: request.requestUser?.id ?? null,
        action: "password_reset_by_admin",
        entityType: "user",
        entityId: user.id,
        details: {
          username: user.username
        }
      });

      return {
        user
      };
    }
  );

  app.get(
    "/admin/audit-events",
    {
      preHandler: requireSuperAdmin
    },
    async (request) => {
      const limit = z.coerce.number().min(1).max(200).default(50).parse((request.query as { limit?: string }).limit);
      return {
        auditEvents: await listAuditEvents(limit)
      };
    }
  );

  app.get(
    "/admin/maintenance/overview",
    {
      preHandler: requireSuperAdmin
    },
    async () => ({
      recycleCandidates: await listExpiredRecycleCandidates(),
      versionCandidates: await listPrunableVersionCandidates()
    })
  );

  app.get(
    "/admin/import-guidance",
    {
      preHandler: requireSuperAdmin
    },
    async () => ({
      supportedFileTypes: ["docx", "xlsx", "pptx", "pdf", "txt", "md"],
      maxFileSizeBytes: 10 * 1024 * 1024,
      recommendedLayout: {
        personal: "/import/personal/<username>/",
        department: [
          "/import/department/<dept>/Collaboration Area/",
          "/import/department/<dept>/Publishing Area/",
          "/import/department/<dept>/Archive Area/"
        ],
        publicKnowledge: "/import/public/<category>/"
      },
      publicKnowledgeCategories: await listPublicKnowledgeCategories(),
      notes: [
        "Stage source files in the recommended layout before running the initial import.",
        "Keep old Office formats as upload/download only; online editing is limited to docx, xlsx, and pptx.",
        "Preserve original file names and last-modified timestamps when preparing import data."
      ]
    })
  );

  app.get(
    "/admin/integrations/onlyoffice/status",
    {
      preHandler: requireSuperAdmin
    },
    async () => ({
      onlyOffice: await getOnlyOfficeStatus()
    })
  );

  app.post(
    "/admin/maintenance/run",
    {
      preHandler: requireSuperAdmin
    },
    async (request) => {
      const body = maintenanceRunSchema.parse(request.body);
      const result = await runRetentionJob(body);

      await createAuditEvent({
        actorUserId: request.requestUser?.id ?? null,
        action: "maintenance_run",
        entityType: "maintenance",
        entityId: body.job,
        details: {
          dryRun: body.dryRun,
          recycleCandidateCount: result.recycleCandidates.length,
          versionCandidateCount: result.versionCandidates.length,
          quotaSummaryCount: result.quotaSummaries.length
        }
      });

      return result;
    }
  );
}
