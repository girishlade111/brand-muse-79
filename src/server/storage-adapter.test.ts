// Storage Adapter Tests
// Validates S3/R2 and Supabase Storage adapter functions.

import { describe, expect, it } from "vitest";
import {
  getStorageProvider,
  getStorageAdapter,
  publicUrlFor,
  urlForAsset,
  uploadAsset,
  deleteAsset,
} from "./storage.server";

describe("Object Storage Adapter", () => {
  it("resolves storage provider correctly", () => {
    const original = process.env.STORAGE_PROVIDER;

    process.env.STORAGE_PROVIDER = "r2";
    expect(getStorageProvider()).toBe("r2");

    process.env.STORAGE_PROVIDER = "s3";
    expect(getStorageProvider()).toBe("s3");

    process.env.STORAGE_PROVIDER = "supabase";
    expect(getStorageProvider()).toBe("supabase");

    if (original) process.env.STORAGE_PROVIDER = original;
    else delete process.env.STORAGE_PROVIDER;
  });

  it("formats public URLs cleanly across adapters", () => {
    const original = process.env.R2_PUBLIC_URL;
    process.env.R2_PUBLIC_URL = "https://cdn.mybrand.com";

    const adapter = getStorageAdapter();
    expect(adapter.publicUrlFor("kit123/assets/logo.svg")).toBe(
      "https://cdn.mybrand.com/kit123/assets/logo.svg",
    );
    expect(adapter.publicUrlFor("/kit123/assets/logo.svg")).toBe(
      "https://cdn.mybrand.com/kit123/assets/logo.svg",
    );

    if (original) process.env.R2_PUBLIC_URL = original;
    else delete process.env.R2_PUBLIC_URL;
  });

  it("resolves asset URLs prioritizing storage_path over stale URLs", () => {
    const original = process.env.R2_PUBLIC_URL;
    process.env.R2_PUBLIC_URL = "https://cdn.mybrand.com";

    expect(
      urlForAsset({
        storage_path: "kit1/assets/mark.png",
        url: "https://old-supabase-bucket.com/mark.png",
      }),
    ).toBe("https://cdn.mybrand.com/kit1/assets/mark.png");

    expect(
      urlForAsset({
        storage_path: null,
        url: "https://external-cdn.com/asset.svg",
      }),
    ).toBe("https://external-cdn.com/asset.svg");

    if (original) process.env.R2_PUBLIC_URL = original;
    else delete process.env.R2_PUBLIC_URL;
  });

  it("handles simulated uploads and deletes gracefully without native socket crashes", async () => {
    const sampleBuffer = new TextEncoder().encode("<svg>test</svg>");
    const res = await uploadAsset(sampleBuffer, "test/mark.svg", "image/svg+xml");

    expect(res).toBeDefined();
    expect(res.storagePath).toBe("test/mark.svg");
    expect(res.url).toContain("test/mark.svg");

    await expect(deleteAsset("test/mark.svg")).resolves.toBeUndefined();
  });
});
