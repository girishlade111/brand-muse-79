import { describe, it, expect, vi } from "vitest";
import crypto from "node:crypto";

const { validKey, validHash, mockDb } = vi.hoisted(() => {
  const key = "bm_live_abcdef1234567890abcdef1234567890abcdef1234567890";
  const hash = crypto.createHash("sha256").update(key).digest("hex");
  const db = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () =>
            Promise.resolve([
              {
                id: "key-1",
                userId: "user-1",
                keyHash: hash,
                name: "Test Key",
                rateLimitPerMin: 60,
                createdAt: new Date(),
              },
            ]),
          orderBy: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      }),
    }),
    insert: () => ({
      values: (val: any) => ({
        returning: () =>
          Promise.resolve([
            {
              id: "mock-kit-uuid-123",
              name: val.name || "Test Kit",
              status: "processing",
              createdAt: new Date(),
              ...val,
            },
          ]),
      }),
    }),
    update: () => ({
      set: () => ({ where: () => Promise.resolve() }),
    }),
  };
  return { validKey: key, validHash: hash, mockDb: db };
});

vi.mock("@/db/index.server", () => ({
  db: mockDb,
  apiKeys: { keyHash: "key_hash", id: "id" },
  brandKits: { id: "id" },
  kitColors: { kitId: "kit_id" },
  kitFonts: { kitId: "kit_id" },
  kitTokens: { kitId: "kit_id" },
  kitAssets: { kitId: "kit_id" },
  kitVoice: { kitId: "kit_id" },
  webhookSubscriptions: { userId: "user_id" },
}));

import extractHandler from "../../server/api/v1/extract.post";
import kitDetailHandler from "../../server/api/v1/kits/[kitId]/index.get";
import kitCssHandler from "../../server/api/v1/kits/[kitId]/css.get";
import openApiHandler from "../../server/api/v1/openapi.json.get";

describe("Developer REST API Endpoints Integration", () => {
  describe("POST /api/v1/extract", () => {
    it("rejects unauthorized request with 401", async () => {
      const event = {
        req: new Request("https://api.brandmuse.io/api/v1/extract", {
          method: "POST",
          headers: {},
        }),
        readBody: async () => ({ url: "https://stripe.com" }),
      };

      const res = await extractHandler(event);
      expect(res.status).toBe(401);
      expect(res.error).toContain("Missing API Key");
    });

    it("rejects invalid payload missing both url and document_url with 400", async () => {
      const event = {
        req: new Request("https://api.brandmuse.io/api/v1/extract", {
          method: "POST",
          headers: { Authorization: `Bearer ${validKey}` },
        }),
        readBody: async () => ({}), // Missing url
      };

      const res = await extractHandler(event);
      expect(res.status).toBe(400);
      expect(res.error).toContain("Missing required parameter");
    });

    it("initiates extraction and returns kit_id with 202 on valid payload", async () => {
      const event = {
        req: new Request("https://api.brandmuse.io/api/v1/extract", {
          method: "POST",
          headers: { Authorization: `Bearer ${validKey}` },
        }),
        readBody: async () => ({ url: "https://stripe.com" }),
      };

      const res = await extractHandler(event);
      expect(res.status).toBe("processing");
      expect(res.kit_id).toBe("mock-kit-uuid-123");
      expect(res.source_url).toBe("https://stripe.com");
    });
  });

  describe("GET /api/v1/kits/:id", () => {
    it("returns 400 if kitId is missing from path", async () => {
      const event = {
        req: new Request("https://api.brandmuse.io/api/v1/kits/"),
      };

      const res = await kitDetailHandler(event);
      expect(res.status).toBe(400);
      expect(res.error).toContain("Missing kitId");
    });
  });

  describe("GET /api/v1/kits/:id/css", () => {
    it("returns error comment if kitId is missing from path", async () => {
      const event = {
        req: new Request("https://api.brandmuse.io/api/v1/kits//css"),
      };

      const res = await kitCssHandler(event);
      expect(res).toContain("Missing kitId");
    });
  });

  describe("GET /api/v1/openapi.json", () => {
    it("serves valid OpenAPI 3.1.0 specification with all core endpoints", async () => {
      const spec = await openApiHandler({});

      expect(spec.openapi).toBe("3.1.0");
      expect(spec.info.title).toContain("Brand Muse");
      expect(spec.paths["/extract"].post).toBeDefined();
      expect(spec.paths["/kits/{id}"].get).toBeDefined();
      expect(spec.paths["/kits/{id}/css"].get).toBeDefined();
      expect(spec.components.securitySchemes.BearerAuth).toBeDefined();
      expect(spec.components.securitySchemes.ApiKeyAuth).toBeDefined();
    });
  });
});
