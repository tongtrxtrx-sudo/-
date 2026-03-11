import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { env } from "./config.js";
import { bootstrapDatabase } from "./db.js";
import { registerEditorRoutes } from "./routes/editor.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerContentRoutes } from "./routes/content.js";
import { registerSpaceRoutes } from "./routes/spaces.js";
import { registerPublicKnowledgeRoutes } from "./routes/publicKnowledge.js";
import { ensureStorageRoot } from "./storage.js";
import { startEditorCallbackProcessor } from "./editorCallbackProcessor.js";

const app = Fastify({
  logger: true
});

await app.register(cors, {
  origin: env.CORS_ORIGIN
});
await app.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1
  }
});

app.get("/health", async () => ({
  status: "ok"
}));

await registerAuthRoutes(app);
await registerAdminRoutes(app);
await registerSpaceRoutes(app);
await registerContentRoutes(app);
await registerEditorRoutes(app);
await registerPublicKnowledgeRoutes(app);

await bootstrapWithRetry();

const stopEditorCallbackProcessor = startEditorCallbackProcessor(app.log);
app.addHook("onClose", async () => {
  stopEditorCallbackProcessor();
});

await app.listen({
  host: "0.0.0.0",
  port: env.API_PORT
});

async function bootstrapWithRetry(): Promise<void> {
  await ensureStorageRoot();

  const maxAttempts = 10;
  const delayMs = 2000;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await bootstrapDatabase();
      return;
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }

      app.log.warn(
        {
          attempt,
          maxAttempts,
          error
        },
        "Database bootstrap failed. Retrying."
      );

      await new Promise((resolve) => {
        setTimeout(resolve, delayMs);
      });
    }
  }
}
