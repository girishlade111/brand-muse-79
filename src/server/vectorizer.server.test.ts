import { describe, expect, it } from "vitest";
import { SaveVectorizedLogoInputSchema, VectorizeLogoServerInputSchema } from "./vectorizer.server";

describe("Logo Vectorizer Server Engine", () => {
  const validUuid = "123e4567-e89b-12d3-a456-426614174000";

  it("validates input schemas for saving vectorized logo assets", () => {
    const valid = SaveVectorizedLogoInputSchema.safeParse({
      kitId: validUuid,
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M0 0"/></svg>',
      variantName: "logo-vector-dark",
      width: 512,
      height: 512,
    });

    expect(valid.success).toBe(true);

    const invalidUuid = SaveVectorizedLogoInputSchema.safeParse({
      kitId: "not-a-valid-uuid",
      svg: "<svg></svg>",
    });

    expect(invalidUuid.success).toBe(false);

    const emptySvg = SaveVectorizedLogoInputSchema.safeParse({
      kitId: validUuid,
      svg: "",
    });

    expect(emptySvg.success).toBe(false);
  });

  it("validates server-side vectorization configuration schemas", () => {
    const valid = VectorizeLogoServerInputSchema.safeParse({
      kitId: validUuid,
      assetId: validUuid,
      colorCount: 4,
      curveSmoothness: 75,
      pathPrecision: 90,
      bgTolerance: 20,
      stripBg: true,
    });

    expect(valid.success).toBe(true);

    const invalidColorCount = VectorizeLogoServerInputSchema.safeParse({
      kitId: validUuid,
      colorCount: 20, // max is 16
    });

    expect(invalidColorCount.success).toBe(false);

    const invalidSmoothness = VectorizeLogoServerInputSchema.safeParse({
      kitId: validUuid,
      curveSmoothness: 150, // max is 100
    });

    expect(invalidSmoothness.success).toBe(false);
  });
});
