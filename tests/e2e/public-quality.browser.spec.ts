import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page, baseURL }) => {
  const secret = process.env.E2E_VERCEL_BYPASS_SECRET;
  if (secret && baseURL) {
    const origin = new URL(baseURL).origin;
    await page.route("**/*", async (route) => {
      if (new URL(route.request().url()).origin !== origin)
        return route.continue();
      const response = await route.fetch({
        maxRedirects: 0,
        headers: {
          ...route.request().headers(),
          "x-vercel-protection-bypass": secret,
        },
      });
      await route.fulfill({ response });
    });
  }
});

// Non-mutating public-page checks. Run against a locally started app or accessible preview.
for (const path of ["/", "/contact", "/apropos", "/sign-in", "/sign-up"]) {
  test(`public rendering and horizontal overflow: ${path}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const response = await page.goto(path, { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
  });
}

test("password visibility has an accessible name", async ({ page }) => {
  await page.goto("/sign-in");
  const password = page.getByLabel("Mot de passe", { exact: true });
  await expect(password).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: /afficher.*mot de passe/i }).click();
  await expect(password).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: /masquer.*mot de passe/i }).click();
  await expect(password).toHaveAttribute("type", "password");
});

test("sign-in remains reachable on short screens", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 400 });
  await page.goto("/sign-in");
  const submit = page.getByRole("button", { name: "Se connecter", exact: true });
  await submit.scrollIntoViewIfNeeded();
  await expect(submit).toBeInViewport();
  const home = page.getByTitle("Accueil", { exact: true });
  await home.scrollIntoViewIfNeeded();
  await expect(home).toBeInViewport();
});
