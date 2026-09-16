import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// Local-disk document storage for the prototype — no object storage
// (S3/R2/Vercel Blob) is configured yet. Files live outside the repo tree
// state (gitignored `uploads/`), keyed by a random name so a guessed
// document id alone doesn't let you fetch someone else's file — the API
// route in src/app/api/documents/[id]/file still re-checks org access via
// withTenantContext before ever reading from disk. Swap this module for a
// real object-storage client in Phase 5; nothing else needs to change since
// callers only see `relativePath` / `readStoredFile`.
const STORAGE_ROOT = path.join(process.cwd(), "uploads");

export async function saveUploadedFile(
  organizationId: string,
  file: File,
): Promise<{ relativePath: string; originalName: string }> {
  const bytes = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const relativePath = path.posix.join(organizationId, `${randomUUID()}-${safeName}`);

  const absolutePath = path.join(STORAGE_ROOT, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, bytes);

  return { relativePath, originalName: file.name };
}

export async function readStoredFile(relativePath: string): Promise<Buffer> {
  const absolutePath = path.join(STORAGE_ROOT, relativePath);
  if (!absolutePath.startsWith(STORAGE_ROOT)) {
    throw new Error("Invalid file path");
  }
  return readFile(absolutePath);
}
