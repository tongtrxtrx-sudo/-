import { z } from "zod";

function emptyStringToUndefined(value: unknown): unknown {
  if (value === "") {
    return undefined;
  }
  return value;
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().min(1),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  JWT_SECRET: z.string().min(16).default("replace-with-a-long-random-secret"),
  INITIAL_SUPER_ADMIN_USERNAME: z.string().min(1).default("admin"),
  INITIAL_SUPER_ADMIN_PASSWORD: z.string().min(12).default("ChangeMe123!"),
  PUBLIC_KNOWLEDGE_SPACE_NAME: z.string().min(1).default("Public Knowledge Base"),
  FILE_STORAGE_ROOT: z.string().min(1).default("./.data/files"),
  API_PUBLIC_BASE_URL: z.string().url().default("http://localhost:3001"),
  ONLYOFFICE_DOCUMENT_SERVER_URL: z.preprocess(emptyStringToUndefined, z.string().url().optional()),
  ONLYOFFICE_JWT_SECRET: z.preprocess(emptyStringToUndefined, z.string().optional()),
  EDIT_LOCK_MINUTES: z.coerce.number().min(1).max(240).default(30)
});

export const env = envSchema.parse(process.env);
