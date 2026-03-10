import { compare, hash } from "bcryptjs";
import jwt from "jsonwebtoken";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { RequestUser } from "./types.js";
import { createAuditEvent, findUserById } from "./db.js";
import { env } from "./config.js";

declare module "fastify" {
  interface FastifyRequest {
    requestUser?: RequestUser;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, 10);
}

export async function verifyPassword(password: string, hashValue: string): Promise<boolean> {
  return compare(password, hashValue);
}

export function signToken(payload: RequestUser): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    subject: payload.id,
    expiresIn: "8h"
  });
}

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const header = request.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    reply.code(401).send({
      message: "Missing bearer token."
    });
    return;
  }

  try {
    const token = header.slice("Bearer ".length);
    const decoded = jwt.verify(token, env.JWT_SECRET) as { sub: string };
    const user = await findUserById(decoded.sub);

    if (!user || user.accountState === "DISABLED" || user.accountState === "LOCKED") {
      reply.code(401).send({
        message: "Session is no longer valid."
      });
      return;
    }

    request.requestUser = {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      accountState: user.accountState,
      departmentId: user.departmentId
    };
  } catch {
    reply.code(401).send({
      message: "Invalid bearer token."
    });
  }
}

export async function requireSuperAdmin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  await requireAuth(request, reply);
  if (reply.sent) {
    return;
  }

  if (request.requestUser?.role !== "SUPER_ADMIN") {
    await createAuditEvent({
      actorUserId: request.requestUser?.id ?? null,
      action: "authorization_denied",
      entityType: "route",
      entityId: request.url,
      details: {
        reason: "super_admin_required"
      }
    });
    reply.code(403).send({
      message: "Super administrator access is required."
    });
  }
}

