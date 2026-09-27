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

test("le formulaire valide sans envoyer de connexion", async ({ page }) => {
  await page.goto("/sign-in", { waitUntil: "domcontentloaded" });
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(
    page.getByText("Entrer une adresse email valide.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Le mot de passe doit contenir au moins 8 caractères.", {
      exact: true,
    }),
  ).toBeVisible();
});

test("la création de projet exige une connexion", async ({ page }) => {
  await page.goto("/projects/new", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/sign-in(?:\?|$)/);
  await expect(
    page.getByRole("button", { name: "Se connecter", exact: true }),
  ).toBeVisible();
});

test("le compte de test accède à ses projets", async ({ page }) => {
  test.skip(
    !process.env.E2E_EMAIL || !process.env.E2E_PASSWORD,
    "Configurer un compte de test dans .env.e2e.local",
  );
  await page.goto("/sign-in", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email", { exact: true }).fill(process.env.E2E_EMAIL!);
  await page
    .getByLabel("Mot de passe", { exact: true })
    .fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page).toHaveURL(/\/projects(?:\?|$)/);
  await expect(
    page.getByRole("heading", { name: "Vos projets", exact: true }),
  ).toBeVisible();
});
