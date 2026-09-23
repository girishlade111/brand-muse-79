import { describe, it, expect, vi } from "vitest";
import extractHandler from "../../server/api/v1/extract.post";
import kitDetailHandler from "../../server/api/v1/kits/[kitId]/index.get";
import kitCssHandler from "../../server/api/v1/kits/[kitId]/css.get";
import openApiHandler from "../../server/api/v1/openapi.json.get";
import { hashApiKey } from "./api-auth.server";

describe("Developer REST API Endpoints Integration", () => {
  const validKey = "bm_live_abcdef1234567890abcdef1234567890abcdef1234567890";
  const validHash = hashApiKey(validKey);

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
      // Mock db containing valid API key
      vi.mock("@/db/index.server", async (importOriginal) => {
        const actual = await importOriginal<any>();
        return {
          ...actual,
          db: {
            ...actual.db,
            select: () => ({
              from: () => ({
                where: () => ({
                  limit: () =>
                    Promise.resolve([
                      {
                        id: "key-1",
                        userId: "user-1",
                        keyHash: validHash,
                        rateLimitPerMin: 60,
                      },
                    ]),
                }),
              }),
            }),
            update: () => ({
              set: () => ({ where: () => Promise.resolve() }),
            }),
          },
        };
      });

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
    it("returns 400 if kitId is missing from path", async () => {
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
