import { test, expect } from "@playwright/test";

// Configure this separately, only if Stripe's destination uses the same bypass.
function webhookHeaders(): Record<string, string> {
  const secret = process.env.E2E_STRIPE_WEBHOOK_BYPASS_SECRET;
  return secret ? { "x-vercel-protection-bypass": secret } : {};
}

test("la connexion est disponible sur la Preview", async ({ request }) => {
  const secret = process.env.E2E_VERCEL_BYPASS_SECRET;
  const response = await request.get("/sign-in", {
    maxRedirects: 0,
    headers: secret ? { "x-vercel-protection-bypass": secret } : {},
  });
  expect(response.status()).toBe(200);
  expect(await response.text()).toContain(
    "Connectez-vous à votre compte ExtravertyAI.",
  );
});

test("Stripe peut atteindre le webhook avec son accès configuré", async ({
  request,
}) => {
  // Browser access is not inherited. Unsigned requests cannot mutate data.
  const response = await request.post("/api/webhooks/stripe", {
    data: {},
    headers: webhookHeaders(),
    maxRedirects: 0,
  });
  expect(
    response.status(),
    "401/403/302 : protection Vercel ; 404 : vérifier le déploiement",
  ).toBe(400);
  expect(await response.text()).toBe("Webhook unavailable");
});

test("le webhook est configuré et rejette une fausse signature", async ({
  request,
}) => {
  const response = await request.post("/api/webhooks/stripe", {
    data: {},
    headers: {
      ...webhookHeaders(),
      "stripe-signature": "invalid-e2e-signature",
    },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(400);
  expect(
    await response.text(),
    "Webhook unavailable indique un secret absent",
  ).toBe("Invalid signature");
});
