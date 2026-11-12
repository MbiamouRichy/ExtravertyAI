import { test, expect } from "@playwright/test";

// Configure this separately, only if Polar's endpoint uses the same bypass.
function webhookHeaders(): Record<string, string> {
  const secret = process.env.E2E_WEBHOOK_BYPASS_SECRET;
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

test("Polar atteint le webhook, qui rejette une fausse signature", async ({
  request,
}) => {
  // Browser access is not inherited. Unsigned requests cannot mutate data.
  const response = await request.post("/api/webhooks/polar", {
    data: {},
    headers: {
      ...webhookHeaders(),
      "webhook-id": "msg_e2e",
      "webhook-timestamp": String(Math.floor(Date.now() / 1000)),
      "webhook-signature": "v1,invalid-e2e-signature",
    },
    maxRedirects: 0,
  });
  expect(
    response.status(),
    "503 : POLAR_WEBHOOK_SECRET absent ; 401/403/302 : protection Vercel ; 404 : vérifier le déploiement",
  ).toBe(400);
  expect(await response.text()).toBe("Invalid signature");
});
