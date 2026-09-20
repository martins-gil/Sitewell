import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

// Document storage. Two backends, chosen by configuration:
//
//  * Cloudflare R2 (any S3-compatible bucket) when R2_ENDPOINT, R2_BUCKET,
//    R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY are all set — what the deployed
//    site uses, since Vercel functions have no persistent disk.
//  * Local disk (the gitignored `uploads/` folder) otherwise — for development.
//
// The bucket stays PRIVATE. Nobody gets a link to it: every download goes
// through /api/documents/[id]/file, which re-checks the caller's organization
// (withTenantContext) before this module is asked for the bytes. Objects are
// keyed `<organizationId>/<random uuid>-<file name>`, so a guessed document id
// alone doesn't reveal a file's key. Callers only see `relativePath` (the key)
// and `readStoredFile`, so switching backend changes nothing else.
const STORAGE_ROOT = path.join(process.cwd(), "uploads");

type R2Settings = { endpoint: string; bucket: string; accessKeyId: string; secretAccessKey: string };

function r2Settings(): R2Settings | null {
  const { R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
  if (!R2_ENDPOINT || !R2_BUCKET || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) return null;
  return { endpoint: R2_ENDPOINT, bucket: R2_BUCKET, accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY };
}

let client: S3Client | null = null;
function r2Client(settings: R2Settings): S3Client {
  client ??= new S3Client({
    region: "auto", // R2 has no regions; "auto" is what it expects.
    endpoint: settings.endpoint,
    // Bucket in the path, not the hostname: works with the EU-jurisdiction endpoint too.
    forcePathStyle: true,
    // Recent AWS SDK versions add checksum headers and a streaming trailer to
    // every request by default, which R2 doesn't handle; only send them when an
    // operation requires it (Cloudflare's documented setting for R2).
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    credentials: { accessKeyId: settings.accessKeyId, secretAccessKey: settings.secretAccessKey },
  });
  return client;
}

function assertSafeKey(relativePath: string) {
  if (relativePath.includes("..") || relativePath.startsWith("/") || relativePath.includes("\\")) {
    throw new Error("Invalid file path");
  }
}

export async function saveUploadedFile(
  organizationId: string,
  file: File,
): Promise<{ relativePath: string; originalName: string }> {
  const bytes = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const relativePath = path.posix.join(organizationId, `${randomUUID()}-${safeName}`);

  const r2 = r2Settings();
  if (r2) {
    await r2Client(r2).send(
      new PutObjectCommand({
        Bucket: r2.bucket,
        Key: relativePath,
        Body: bytes,
        ContentType: file.type || "application/octet-stream",
      }),
    );
    return { relativePath, originalName: file.name };
  }

  const absolutePath = path.join(STORAGE_ROOT, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, bytes);
  return { relativePath, originalName: file.name };
}

export async function readStoredFile(relativePath: string): Promise<Buffer> {
  assertSafeKey(relativePath);

  const r2 = r2Settings();
  if (r2) {
    const object = await r2Client(r2).send(new GetObjectCommand({ Bucket: r2.bucket, Key: relativePath }));
    if (!object.Body) throw new Error("File not found");
    return Buffer.from(await object.Body.transformToByteArray());
  }

  const absolutePath = path.join(STORAGE_ROOT, relativePath);
  if (!absolutePath.startsWith(STORAGE_ROOT)) {
    throw new Error("Invalid file path");
  }
  return readFile(absolutePath);
}
