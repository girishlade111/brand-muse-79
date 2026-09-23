import { test, expect } from "@playwright/test";

// Backend-free smoke coverage for every user-facing route.
//
// These assertions target markup that is server-rendered and independent of
// Supabase/AI credentials, so they run green in any environment. The deep
// flows (extraction, export downloads) live in export-download.spec.ts and
// require a configured backend.

test.describe("route smoke coverage", () => {
  test("landing renders the ingestion hero", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/brand/i);
    await expect(page.getByRole("link", { name: /library/i }).first()).toBeVisible();
  });

  test("manual builder exposes sources, palette, typography and tokens", async ({ page }) => {
    page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
    page.on("console", (msg) => console.log("PAGE CONSOLE:", msg.type(), msg.text()));
    await page.goto("/build");

    await expect(page.getByRole("heading", { name: /build a kit by hand/i })).toBeVisible();

    // Step headings 1–4.
    for (const n of [1, 2, 3, 4]) {
      await expect(page.getByRole("heading", { name: new RegExp(`^${n} — `) })).toBeVisible();
    }

    // Source controls.
    await expect(page.getByRole("button", { name: /read sources/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /auto-build with ai/i })).toBeVisible();

    // Editable palette / type / token rows.
    await expect(page.locator("#kit-name")).toBeVisible();
    await expect(page.locator('[aria-label="Colour 1 hex"]')).toBeVisible();
    await expect(page.locator('[aria-label="Font 1 family"]')).toBeVisible();
    await expect(page.locator('[aria-label="Token 1 name"]')).toBeVisible();

    // Rows can be added and removed. Retry click with toPass() to ensure
    // client hydration is complete before asserting.
    await expect(async () => {
      await page.getByRole("button", { name: "Add colour", exact: true }).click();
      await expect(page.locator('[aria-label="Colour 2 hex"]')).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15_000 });

    await page.getByRole("button", { name: "Add font", exact: true }).click();
    await expect(page.locator('[aria-label="Font 2 family"]')).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: "Add token", exact: true }).click();
    await expect(page.locator('[aria-label="Token 2 name"]')).toBeVisible({ timeout: 10_000 });
  });

  test("library renders its shell", async ({ page }) => {
    await page.goto("/library");
    await expect(page.getByRole("heading", { name: /your brand kits/i })).toBeVisible();
  });

  test("compare view renders both pickers", async ({ page }) => {
    await page.goto("/compare");
    await expect(
      page.getByRole("heading", { name: /two (?:to four )?kits, side by side/i }),
    ).toBeVisible();
    await expect(page.getByLabel("Kit A")).toBeVisible();
    await expect(page.getByLabel("Kit B")).toBeVisible();
    await expect(page.getByRole("button", { name: /swap kits/i })).toBeVisible();
  });

  test("social asset studio standalone preview renders", async ({ page }) => {
    await page.goto("/studio");
    await expect(
      page.getByRole("heading", { name: /social asset studio/i }),
    ).toBeVisible();
  });

  test("developer settings page renders", async ({ page }) => {
    await page.goto("/settings");
    await expect(
      page.getByRole("heading", { name: /developer (?:settings & api|api keys)/i }),
    ).toBeVisible();
  });

  test("design source of truth page renders", async ({ page }) => {
    await page.goto("/design");
    await expect(page.getByRole("heading", { name: /DESIGN\.md/i })).toBeVisible();
  });

  test("template guide renders", async ({ page }) => {
    await page.goto("/start-here");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/start/i);
  });

  test("header navigates between the primary surfaces", async ({ page }) => {
    await page.goto("/build");
    await page.getByRole("link", { name: /^library$/i }).click();
    await expect(page).toHaveURL(/\/library$/);

    await page.getByRole("link", { name: /build by hand/i }).click();
    await expect(page).toHaveURL(/\/build$/);
  });

  test("unknown route falls back to the not-found page", async ({ page }) => {
    await page.goto("/definitely-not-a-route");
    await expect(page.getByText(/page not found/i)).toBeVisible();
  });
});
