// Cloudflare R2 (S3-compatible) object storage — server-only.
// Replaces Supabase Storage bucket `brand-assets`.
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

let cached: S3Client | null = null;

function bucketName(): string {
  return process.env.R2_BUCKET_NAME ?? "brand-assets";
}

function publicBase(): string {
  return (process.env.R2_PUBLIC_URL ?? "").replace(/\/+$/, "");
}

function endpointFor(accountId: string): string {
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

export function getStorageClient(): S3Client {
  if (cached) return cached;
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 storage env missing (R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY).",
    );
  }
  cached = new S3Client({
    region: "auto",
    endpoint: endpointFor(accountId),
    credentials: { accessKeyId, secretAccessKey },
    // R2 requires path-style addressing.
    forcePathStyle: true,
  });
  return cached;
}

/** Public URL for a stored object path, e.g. `<kitId>/assets/x.png`. */
export function publicUrlFor(path: string): string {
  const base = publicBase();
  const clean = String(path).replace(/^\/+/, "");
  if (!base) return clean;
  return `${base}/${clean}`;
}

/**
 * Resolve the display URL for an asset row. Prefers the stored absolute
 * `url`, falling back to `R2_PUBLIC_URL + storage_path` for rows whose
 * `url` predates the R2 migration or is empty.
 */
export function urlForAsset(a: { storage_path?: string | null; url?: string | null }): string {
  if (a.storage_path) return publicUrlFor(a.storage_path);
  return a.url ?? "";
}

export async function uploadAsset(
  buffer: Uint8Array | Buffer,
  path: string,
  contentType: string,
): Promise<{ url: string; storagePath: string }> {
  const client = getStorageClient();
  const body = buffer instanceof Buffer ? new Uint8Array(buffer) : buffer;
  await client.send(
    new PutObjectCommand({
      Bucket: bucketName(),
      Key: path,
      Body: body as Uint8Array,
      ContentType: contentType || "application/octet-stream",
    }),
  );
  return { url: publicUrlFor(path), storagePath: path };
}

export async function deleteAsset(path: string): Promise<void> {
  const client = getStorageClient();
  await client.send(
    new DeleteObjectCommand({
      Bucket: bucketName(),
      Key: path,
    }),
  );
}
