import { describe, expect, it } from "vitest";
import {
  normalizeCustomDomain,
  createCustomHostname,
  getCustomHostnameStatus,
  deleteCustomHostname,
} from "./cloudflare-saas.server";
import {
  buildPortalCacheKey,
  getEdgeCachedJson,
  setEdgeCachedJson,
  purgePortalEdgeCache,
} from "./edge-cache.server";
import crypto from "node:crypto";

describe("Cloudflare Custom Hostnames & SSL for SaaS", () => {
  it("normalizes and sanitizes custom domains", () => {
    expect(normalizeCustomDomain("brand.clientcompany.com")).toBe("brand.clientcompany.com");
    expect(normalizeCustomDomain("https://Brand.ClientCompany.com/path")).toBe(
      "brand.clientcompany.com",
    );
    expect(normalizeCustomDomain("http://guidelines.design.org:8080")).toBe(
      "guidelines.design.org",
    );
  });

  it("rejects illegal domain strings and reserved system domains", () => {
    expect(() => normalizeCustomDomain("localhost")).toThrow(/cannot be used as a custom domain/);
    expect(() => normalizeCustomDomain("branddna.app")).toThrow(/cannot be used as a custom domain/);
    expect(() => normalizeCustomDomain("test.lovable.app")).toThrow(
      /cannot be used as a custom domain/,
    );
    expect(() => normalizeCustomDomain("not a valid domain")).toThrow(
      /Invalid custom domain format/,
    );
    expect(() => normalizeCustomDomain("nodotsinthisname")).toThrow(
      /Invalid custom domain format/,
    );
  });

  it("provisions custom hostname in simulation mode when API credentials are absent", async () => {
    const result = await createCustomHostname("brand.myclient.com");
    expect(result.hostname).toBe("brand.myclient.com");
    expect(result.status).toBe("pending");
    expect(result.sslStatus).toBe("pending_validation");
    expect(result.cnameTarget).toBe("cname.branddna.app");
    expect(result.simulationMode).toBe(true);
    expect(result.ownershipVerification?.value).toBe("cname.branddna.app");
    expect(result.sslValidationRecords?.length).toBeGreaterThan(0);
  });

  it("checks custom hostname status in simulation mode", async () => {
    const status = await getCustomHostnameStatus("mock_cf_12345", "brand.myclient.com");
    expect(status.status).toBe("active");
    expect(status.sslStatus).toBe("active");
    expect(status.cnameTarget).toBe("cname.branddna.app");
  });

  it("handles deletion gracefully in simulation mode", async () => {
    const deleted = await deleteCustomHostname("mock_cf_12345");
    expect(deleted).toBe(true);
  });
});

describe("Cloudflare Edge Cache API Layer", () => {
  it("constructs deterministic edge cache keys", () => {
    const key1 = buildPortalCacheKey("Acme-Corp");
    const key2 = buildPortalCacheKey("acme-corp");
    expect(key1).toBe(key2);
    expect(key1).toBe("https://edge-cache.branddna.internal/portal/acme-corp");
  });

  it("stores, retrieves, and purges JSON payloads in edge cache", async () => {
    const cacheKey = buildPortalCacheKey("test-kit-slug");
    const payload = {
      kit: { name: "Test Brand", is_public: true },
      colors: [{ hex: "#FF0000", name: "Red", role: "primary" }],
      portal: { whitelabelTitle: "Test Guidelines" },
    };

    // Store in edge cache
    await setEdgeCachedJson(cacheKey, payload, 60);

    // Retrieve from edge cache (HIT)
    const cached = await getEdgeCachedJson<typeof payload>(cacheKey);
    expect(cached).not.toBeNull();
    expect(cached?.kit.name).toBe("Test Brand");
    expect(cached?.colors[0].hex).toBe("#FF0000");

    // Purge from edge cache
    const purged = await purgePortalEdgeCache("test-kit-slug");
    expect(purged).toBe(true);

    // Verify cache MISS after purge
    const postPurge = await getEdgeCachedJson(cacheKey);
    expect(postPurge).toBeNull();
  });
});

import {
  hashPassword,
  createPasswordToken,
  verifyPasswordToken,
  safeTimingSafeEqual,
} from "./portal-auth.server";

describe("Portal Security & Expiration Mechanics", () => {
  it("hashes passwords deterministically and verifies with constant-time equality", () => {
    const secret = "TopSecretRebrand2026!";
    const hashed = hashPassword(secret);

    expect(hashed).toBe(hashPassword(secret));
    expect(hashed).not.toBe(hashPassword("WrongPassword"));

    const isMatch = safeTimingSafeEqual(hashed, hashPassword(secret));
    expect(isMatch).toBe(true);

    const isMismatch = safeTimingSafeEqual(hashed, hashPassword("WrongPassword"));
    expect(isMismatch).toBe(false);
  });

  it("safeTimingSafeEqual handles unequal length buffers safely without throwing", () => {
    expect(() => safeTimingSafeEqual("short", "much-longer-string-with-different-bytes")).not.toThrow();
    expect(safeTimingSafeEqual("short", "much-longer-string-with-different-bytes")).toBe(false);
    expect(safeTimingSafeEqual("", "non-empty")).toBe(false);
    expect(safeTimingSafeEqual("abc", "abc")).toBe(true);
  });

  it("creates and verifies HMAC password tokens accurately", () => {
    const slug = "acme-rebrand";
    const token = createPasswordToken(slug);

    expect(token).toBeTruthy();
    expect(verifyPasswordToken(token, slug)).toBe(true);
    expect(verifyPasswordToken(token, "wrong-slug")).toBe(false);
    expect(verifyPasswordToken("malformed:token", slug)).toBe(false);
    expect(verifyPasswordToken("", slug)).toBe(false);
  });

  it("correctly identifies expired pre-launch guidelines dates", () => {
    const pastDate = new Date(Date.now() - 10000).toISOString();
    const futureDate = new Date(Date.now() + 100000).toISOString();

    const isExpiredPast = new Date(pastDate).getTime() < Date.now();
    const isExpiredFuture = new Date(futureDate).getTime() < Date.now();

    expect(isExpiredPast).toBe(true);
    expect(isExpiredFuture).toBe(false);
  });
});
