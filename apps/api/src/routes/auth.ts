import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { createAuditEvent, findUserByUsername, listAccessibleSpaces, listDirectoryUsers, updateUserPassword } from "../db.js";
import { hashPassword, requireAuth, signToken, verifyPassword } from "../auth.js";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12)
});

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post("/auth/login", async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const user = await findUserByUsername(body.username);

    if (!user) {
      await createAuditEvent({
        actorUserId: null,
        action: "login_failed",
        entityType: "user",
        entityId: null,
        details: {
          username: body.username,
          reason: "user_not_found"
        }
      });
      return reply.code(401).send({
        message: "Invalid username or password."
      });
    }

    const matches = await verifyPassword(body.password, user.passwordHash);
    if (!matches) {
      await createAuditEvent({
        actorUserId: user.id,
        action: "login_failed",
        entityType: "user",
        entityId: user.id,
        details: {
          username: user.username,
          reason: "invalid_password"
        }
      });
      return reply.code(401).send({
        message: "Invalid username or password."
      });
    }

    if (user.accountState === "DISABLED" || user.accountState === "LOCKED") {
      await createAuditEvent({
        actorUserId: user.id,
        action: "login_blocked",
        entityType: "user",
        entityId: user.id,
        details: {
          accountState: user.accountState
        }
      });
      return reply.code(403).send({
        message: "This account cannot sign in."
      });
    }

    const requestUser = {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      accountState: user.accountState,
      departmentId: user.departmentId
    };

    await createAuditEvent({
      actorUserId: user.id,
      action: "login_succeeded",
      entityType: "user",
      entityId: user.id,
      details: {
        role: user.role
      }
    });

    return reply.send({
      token: signToken(requestUser),
      user: requestUser,
      spaces: await listAccessibleSpaces(user)
    });
  });

  app.post(
    "/auth/change-password",
    {
      preHandler: requireAuth
    },
    async (request, reply) => {
      if (!request.requestUser) {
        return;
      }

      const body = passwordChangeSchema.parse(request.body);
      const user = await findUserByUsername(request.requestUser.username);
      if (!user) {
        return reply.code(404).send({
          message: "User not found."
        });
      }

      const matches = await verifyPassword(body.currentPassword, user.passwordHash);
      if (!matches) {
        return reply.code(400).send({
          message: "Current password is incorrect."
        });
      }

      const updated = await updateUserPassword(user.id, await hashPassword(body.newPassword));
      if (!updated) {
        return reply.code(404).send({
          message: "User not found."
        });
      }

      await createAuditEvent({
        actorUserId: user.id,
        action: "password_changed",
        entityType: "user",
        entityId: user.id,
        details: {}
      });

      return reply.send({
        token: signToken(updated),
        user: updated
      });
    }
  );

  app.post(
    "/auth/logout",
    {
      preHandler: requireAuth
    },
    async (request) => {
      await createAuditEvent({
        actorUserId: request.requestUser?.id ?? null,
        action: "logout",
        entityType: "user",
        entityId: request.requestUser?.id ?? null,
        details: {}
      });

      return {
        ok: true
      };
    }
  );

  app.get(
    "/auth/me",
    {
      preHandler: requireAuth
    },
    async (request, reply) => {
      if (!request.requestUser) {
        return reply.code(401).send({
          message: "Unauthorized."
        });
      }

      const user = await findUserByUsername(request.requestUser.username);
      if (!user) {
        return reply.code(404).send({
          message: "User not found."
        });
      }

      return {
        user: request.requestUser,
        spaces: await listAccessibleSpaces(user)
      };
    }
  );

  app.get(
    "/directory/users",
    {
      preHandler: requireAuth
    },
    async (request, reply) => {
      if (!request.requestUser) {
        return reply.code(401).send({
          message: "Unauthorized."
        });
      }

      return {
        users: await listDirectoryUsers({
          excludeUserId: request.requestUser.id
        })
      };
    }
  );
}
