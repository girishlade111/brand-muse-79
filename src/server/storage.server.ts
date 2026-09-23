// Object Storage Facade
// Seamlessly delegates to S3StorageAdapter (Cloudflare R2 / AWS S3) or SupabaseStorageAdapter
// according to STORAGE_PROVIDER or DATABASE_PROVIDER.

import { getStorageAdapter } from "./storage-adapter.server";

export function publicUrlFor(path: string): string {
  return getStorageAdapter().publicUrlFor(path);
}

export function urlForAsset(a: { storage_path?: string | null; url?: string | null }): string {
  return getStorageAdapter().urlForAsset(a);
}

export async function uploadAsset(
  buffer: Uint8Array | Buffer,
  path: string,
  contentType: string,
): Promise<{ url: string; storagePath: string }> {
  return getStorageAdapter().uploadAsset(buffer, path, contentType);
}

export async function deleteAsset(path: string): Promise<void> {
  return getStorageAdapter().deleteAsset(path);
}

export { getStorageAdapter, getStorageProvider } from "./storage-adapter.server";
