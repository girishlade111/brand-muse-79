import { describe, expect, it } from "vitest";
import {
  FigmaSyncInputSchema,
  executeGetFigmaTokens,
  handleFigmaTokensApiRequest,
} from "./figma-sync.server";

describe("Figma Token Synchronization Server Engine", () => {
  const validUuid = "123e4567-e89b-12d3-a456-426614174000";

  it("validates input schemas for token synchronization", () => {
    const valid = FigmaSyncInputSchema.safeParse({
      kitId: validUuid,
      token: "secretShareToken123",
    });

    expect(valid.success).toBe(true);

    const invalidUuid = FigmaSyncInputSchema.safeParse({
      kitId: "not-a-valid-uuid",
    });

    expect(invalidUuid.success).toBe(false);
  });

  describe("executeGetFigmaTokens Access Control & Formatting", () => {
    const sampleKit = {
      id: validUuid,
      name: "Kyoto Ink Works",
      isPublic: false,
      shareToken: "validShareToken999",
      updatedAt: new Date("2026-09-23T00:00:00Z"),
    };

    const sampleColors = [{ hex: "#0A0A0A", role: "primary", name: "Sumi Black" }];

    it("rejects unauthorized requests when private kit is missing valid token", async () => {
      await expect(
        executeGetFigmaTokens(
          { kitId: validUuid, token: "wrongToken" },
          { kit: sampleKit, colors: sampleColors },
        ),
      ).rejects.toThrow("Unauthorized");
    });

    it("permits access when valid shareToken is provided", async () => {
      const res = await executeGetFigmaTokens(
        { kitId: validUuid, token: "validShareToken999" },
        {
          kit: sampleKit,
          colors: sampleColors,
          fonts: [{ family: "Cormorant Garamond", role: "display" }],
          tokens: [{ category: "spacing", name: "md", value: "16px" }],
          assets: [{ kind: "logo", url: "https://example.com/logo.svg" }],
        },
      );

      expect(res).toBeDefined();
      expect(res.kitId).toBe(validUuid);
      expect(res.kitName).toBe("Kyoto Ink Works");
      expect(res.hash).toBeTruthy();
      expect(res.dtcg.color).toBeDefined();
      expect(res.figmaVariables.collections.length).toBe(3);
    });

    it("permits access without token when kit is public", async () => {
      const publicKit = { ...sampleKit, isPublic: true };
      const res = await executeGetFigmaTokens(
        { kitId: validUuid },
        {
          kit: publicKit,
          colors: sampleColors,
          fonts: [],
          tokens: [],
          assets: [],
        },
      );

      expect(res.kitId).toBe(validUuid);
      expect(res.dtcg).toBeDefined();
    });
  });

  describe("handleFigmaTokensApiRequest REST Handler", () => {
    it("handles CORS OPTIONS preflight request with status 204", async () => {
      const req = new Request("http://localhost/api/v1/kits/123/tokens", {
        method: "OPTIONS",
      });

      const res = await handleFigmaTokensApiRequest(req, validUuid);
      expect(res.status).toBe(204);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });

    it("handles invalid kitId with status 400", async () => {
      const req = new Request("http://localhost/api/v1/kits/invalid-uuid/tokens", {
        method: "GET",
      });

      const res = await handleFigmaTokensApiRequest(req, "invalid-uuid");
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Invalid request parameters");
    });
  });
});
