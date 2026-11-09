import assert from "node:assert/strict";
import { test } from "node:test";

// Facturation par Polar : aucune clé Stripe dans l'environnement.
delete process.env.STRIPE_SECRET_KEY;

test("the app loads without a Stripe key; only a real Stripe call fails", async () => {
  // Le chargement du module (et donc le build Next) ne doit rien exiger.
  const { stripe } = await import("../lib/stripe");

  // Ni `await` ni un retour asynchrone ne le prennent pour une promesse.
  assert.equal((stripe as unknown as { then?: unknown }).then, undefined);
  assert.equal(await Promise.resolve(stripe), stripe);

  assert.throws(() => stripe.subscriptions, /STRIPE_NOT_CONFIGURED/);
});

test("with a key, the client is created once and used like a Stripe client", async () => {
  process.env.STRIPE_SECRET_KEY = "sk_test_placeholder_for_unit_tests";
  const { stripe } = await import("../lib/stripe");

  assert.equal(typeof stripe.subscriptions.retrieve, "function");
  assert.equal(typeof stripe.webhooks.constructEvent, "function");
  // Même instance à chaque accès : une seule configuration.
  assert.equal(stripe.subscriptions, stripe.subscriptions);
});
