import { test, expect } from "@playwright/test";
import { stat } from "node:fs/promises";

// Requires a live backend (Supabase + AI gateway) configured in .env.
// The manual builder saves straight to the library, so this spec builds a kit
// on /build and then exercises the kit page's export downloads.
test("export tab downloads PDF and ZIP for a manually-created kit", async ({ page }) => {
  // 1. The hand-builder lives at /build.
  await page.goto("/build");
  await expect(page.getByRole("heading", { name: /build a kit by hand/i })).toBeVisible();

  // 2. Fill the editorial form (ids/aria-labels match src/routes/build.tsx).
  await page.locator("#kit-name").fill("E2E Test Kit");
  await page.locator('[aria-label="Colour 1 hex"]').fill("#1D3557");
  await page.locator('[aria-label="Colour 1 role"]').fill("primary");
  await page.locator('[aria-label="Font 1 family"]').fill("Inter");
  await page.locator('[aria-label="Font 1 role"]').fill("body");
  await page.locator('[aria-label="Token 1 category"]').fill("spacing");
  await page.locator('[aria-label="Token 1 name"]').fill("space-md");
  await page.locator('[aria-label="Token 1 value"]').fill("16px");

  // 3. Save → the kit page opens.
  await page.getByRole("button", { name: /save kit/i }).click();
  await page.waitForURL(/\/kit\/[^/]+/, { timeout: 90_000 });

  // 4. Palette, typography and tokens render on the kit page.
  await expect(page.getByRole("heading", { name: "Colors" })).toBeVisible();
  await expect(page.getByText("#1D3557", { exact: false }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Typography" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tokens" })).toBeVisible();
  await expect(page.getByText("space-md").first()).toBeVisible();

  // 5. Open the Export section (section anchor, not a tab).
  await page.getByRole("link", { name: "Export" }).click();

  // 6. PDF download
  const [pdfDownload] = await Promise.all([
    page.waitForEvent("download", { timeout: 60_000 }),
    page.getByRole("button", { name: /brand guide \(\.pdf\)/i }).click(),
  ]);
  expect(pdfDownload.suggestedFilename()).toMatch(/-brand-guide\.pdf$/);
  const pdfPath = await pdfDownload.path();
  expect(pdfPath).toBeTruthy();
  const pdfStats = await stat(pdfPath!);
  expect(pdfStats.size).toBeGreaterThan(1000);

  // 7. ZIP download
  const [zipDownload] = await Promise.all([
    page.waitForEvent("download", { timeout: 60_000 }),
    page.getByRole("button", { name: /download full kit \(\.zip\)/i }).click(),
  ]);
  expect(zipDownload.suggestedFilename()).toMatch(/-brand-kit\.zip$/);
  const zipPath = await zipDownload.path();
  expect(zipPath).toBeTruthy();
  const zipStats = await stat(zipPath!);
  expect(zipStats.size).toBeGreaterThan(1000);
});
