import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth.js";
import { z } from "zod";
import { findUserByUsername, getSpaceQuotaSummary, listAccessibleSpaces } from "../db.js";
import { requireReadableSpace } from "../permissions.js";

export async function registerSpaceRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/spaces",
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
        spaces: await listAccessibleSpaces(user)
      };
    }
  );

  app.get(
    "/spaces/:spaceId/quota",
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

      try {
        await requireReadableSpace(request.requestUser, params.spaceId);
        return {
          quota: await getSpaceQuotaSummary(params.spaceId)
        };
      } catch (error) {
        return reply.code(403).send({
          message: (error as Error).message
        });
      }
    }
  );
}
