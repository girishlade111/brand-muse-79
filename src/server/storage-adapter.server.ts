// Unified Object Storage Adapter
// Supports S3-compatible storage (Cloudflare R2, AWS S3) and Supabase Storage
// Edge-compatible, pure fetch dispatch, zero Node.js native socket requirements.

import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getAdmin } from "./supabase-admin.server";

export interface StorageAdapter {
  uploadAsset(
    buffer: Uint8Array | Buffer,
    path: string,
    contentType: string,
  ): Promise<{ url: string; storagePath: string }>;
  deleteAsset(path: string): Promise<void>;
  publicUrlFor(path: string): string;
  urlForAsset(asset: { storage_path?: string | null; url?: string | null }): string;
}

export type StorageProvider = "r2" | "s3" | "supabase";

export function getStorageProvider(): StorageProvider {
  const provider = (process.env.STORAGE_PROVIDER || "").toLowerCase().trim();
  if (provider === "supabase") return "supabase";
  if (provider === "s3") return "s3";
  // Default to R2 / S3
  return "r2";
}

// ----------------------------------------------------------------------------
// S3 / Cloudflare R2 Storage Adapter
// ----------------------------------------------------------------------------
class S3StorageAdapter implements StorageAdapter {
  private client: S3Client | null = null;

  private bucketName(): string {
    return process.env.R2_BUCKET_NAME || process.env.S3_BUCKET_NAME || "brand-assets";
  }

  private publicBase(): string {
    return (
      process.env.R2_PUBLIC_URL ||
      process.env.S3_PUBLIC_URL ||
      process.env.VITE_R2_PUBLIC_URL ||
      ""
    ).replace(/\/+$/, "");
  }

  private getClient(): S3Client {
    if (this.client) return this.client;
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
    const endpoint =
      process.env.S3_ENDPOINT ||
      (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);

    if (!accessKeyId || !secretAccessKey) {
      // Mock client for local / simulation environments
      this.client = new S3Client({
        region: "auto",
        credentials: {
          accessKeyId: accessKeyId || "mock-access-key",
          secretAccessKey: secretAccessKey || "mock-secret-key",
        },
      });
      return this.client;
    }

    this.client = new S3Client({
      region: process.env.AWS_REGION || "auto",
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    });
    return this.client;
  }

  publicUrlFor(path: string): string {
    const base = this.publicBase();
    const clean = String(path).replace(/^\/+/, "");
    if (!base)
      return clean.startsWith("http") ? clean : `https://assets.branddna.internal/${clean}`;
    return `${base}/${clean}`;
  }

  urlForAsset(a: { storage_path?: string | null; url?: string | null }): string {
    if (a.storage_path) return this.publicUrlFor(a.storage_path);
    return a.url ?? "";
  }

  async uploadAsset(
    buffer: Uint8Array | Buffer,
    path: string,
    contentType: string,
  ): Promise<{ url: string; storagePath: string }> {
    const client = this.getClient();
    const body = buffer instanceof Buffer ? new Uint8Array(buffer) : buffer;

    // In simulation mode without credentials, return synthetic URL
    if (!process.env.R2_ACCESS_KEY_ID && !process.env.AWS_ACCESS_KEY_ID) {
      return { url: this.publicUrlFor(path), storagePath: path };
    }

    await client.send(
      new PutObjectCommand({
        Bucket: this.bucketName(),
        Key: path,
        Body: body as Uint8Array,
        ContentType: contentType || "application/octet-stream",
      }),
    );
    return { url: this.publicUrlFor(path), storagePath: path };
  }

  async deleteAsset(path: string): Promise<void> {
    if (!process.env.R2_ACCESS_KEY_ID && !process.env.AWS_ACCESS_KEY_ID) {
      return;
    }
    const client = this.getClient();
    await client.send(
      new DeleteObjectCommand({
        Bucket: this.bucketName(),
        Key: path,
      }),
    );
  }
}

// ----------------------------------------------------------------------------
// Supabase Storage Adapter
// ----------------------------------------------------------------------------
class SupabaseStorageAdapter implements StorageAdapter {
  private bucketName(): string {
    return process.env.SUPABASE_STORAGE_BUCKET || "brand-assets";
  }

  publicUrlFor(path: string): string {
    const admin = getAdmin();
    const clean = String(path).replace(/^\/+/, "");
    const { data } = admin.storage.from(this.bucketName()).getPublicUrl(clean);
    return data.publicUrl;
  }

  urlForAsset(a: { storage_path?: string | null; url?: string | null }): string {
    if (a.storage_path) return this.publicUrlFor(a.storage_path);
    return a.url ?? "";
  }

  async uploadAsset(
    buffer: Uint8Array | Buffer,
    path: string,
    contentType: string,
  ): Promise<{ url: string; storagePath: string }> {
    const admin = getAdmin();
    const body = buffer instanceof Buffer ? new Uint8Array(buffer) : buffer;

    const { error } = await admin.storage.from(this.bucketName()).upload(path, body, {
      contentType: contentType || "application/octet-stream",
      upsert: true,
    });

    if (error) {
      console.warn("[storage-adapter] Supabase storage upload warning:", error.message);
    }

    return { url: this.publicUrlFor(path), storagePath: path };
  }

  async deleteAsset(path: string): Promise<void> {
    const admin = getAdmin();
    const { error } = await admin.storage.from(this.bucketName()).remove([path]);
    if (error) {
      console.warn("[storage-adapter] Supabase storage delete warning:", error.message);
    }
  }
}

// Storage Adapter Singletons
const s3Adapter = new S3StorageAdapter();
const supabaseAdapter = new SupabaseStorageAdapter();

export function getStorageAdapter(): StorageAdapter {
  const provider = getStorageProvider();
  if (provider === "supabase") {
    return supabaseAdapter;
  }
  return s3Adapter;
}
