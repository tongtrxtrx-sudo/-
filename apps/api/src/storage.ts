import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "./config.js";

const storageRoot = resolve(env.FILE_STORAGE_ROOT);

export async function ensureStorageRoot(): Promise<void> {
  await mkdir(storageRoot, {
    recursive: true
  });
}

export async function saveBuffer(input: {
  fileName: string;
  content: Buffer;
}): Promise<{
  storageKey: string;
  absolutePath: string;
}> {
  await ensureStorageRoot();
  const sanitizedFileName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storageKey = `${randomUUID()}-${sanitizedFileName}`;
  const absolutePath = join(storageRoot, storageKey);
  await writeFile(absolutePath, input.content);
  return {
    storageKey,
    absolutePath
  };
}

export async function readBuffer(storageKey: string): Promise<Buffer> {
  return readFile(join(storageRoot, storageKey));
}

export async function deleteBuffer(storageKey: string): Promise<void> {
  await unlink(join(storageRoot, storageKey));
}
