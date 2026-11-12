import assert from "node:assert/strict";
import { test } from "node:test";
import { planForPolarProduct, polarSubscriptionState } from "../lib/billing-polar";
import { matchesPolarProduct } from "../lib/checkout-price";
import {
  isEndedPolarSubscription,
  isPolarCheckoutUrl,
  type PolarProduct,
  type PolarSubscription,
} from "../lib/polar";

process.env.POLAR_STARTER_PRODUCT_ID = "prod-starter";
process.env.POLAR_PRO_PRODUCT_ID = "prod-pro";
process.env.POLAR_BUSINESS_PRODUCT_ID = "prod-business";

const subscription = (
  overrides: Partial<PolarSubscription> = {},
): PolarSubscription => ({
  id: "sub-1",
  status: "active",
  customer_id: "cus-1",
  product_id: "prod-pro",
  amount: 3999,
  currency: "usd",
  recurring_interval: "month",
  current_period_start: "2026-11-01T00:00:00Z",
  current_period_end: "2026-12-01T00:00:00Z",
  trial_start: null,
  trial_end: null,
  cancel_at_period_end: false,
  metadata: { projectId: "project-1", plan: "pro" },
  ...overrides,
});

const product = (overrides: Partial<PolarProduct> = {}): PolarProduct => ({
  is_archived: false,
  is_recurring: true,
  recurring_interval: "month",
  recurring_interval_count: 1,
  prices: [
    {
      amount_type: "fixed",
      price_amount: 1599,
      price_currency: "usd",
      is_archived: false,
    },
  ],
  ...overrides,
});

test("un abonnement actif ouvre le cycle payé de Polar", () => {
  const state = polarSubscriptionState(subscription());
  assert.equal(state.status, "active");
  assert.equal(state.plan, "pro");
  assert.equal(state.paidCycle, true);
  assert.equal(state.metadataProjectId, "project-1");
  assert.equal(state.startsAt, Date.UTC(2026, 10, 1) / 1000);
  assert.equal(state.endsAt, Date.UTC(2026, 11, 1) / 1000);
});

test("l'essai utilise ses propres dates et n'est pas un cycle payé", () => {
  const state = polarSubscriptionState(
    subscription({
      status: "trialing",
      trial_start: "2026-11-02T00:00:00Z",
      trial_end: "2026-11-12T00:00:00Z",
    }),
  );
  assert.equal(state.status, "trialing");
  assert.equal(state.paidCycle, false);
  assert.equal(state.startsAt, Date.UTC(2026, 10, 2) / 1000);
  assert.equal(state.endsAt, Date.UTC(2026, 10, 12) / 1000);
});

test("un paiement échoué suspend l'accès sans ouvrir de cycle", () => {
  const state = polarSubscriptionState(subscription({ status: "past_due" }));
  assert.equal(state.status, "paused");
  assert.equal(state.providerStatus, "past_due");
  assert.equal(state.paidCycle, false);
});

test("un abonnement résilié ou révoqué devient inactif", () => {
  const state = polarSubscriptionState(subscription({ status: "canceled" }));
  assert.equal(state.status, "inactive");
  assert.equal(state.paidCycle, false);
});

test("la résiliation en fin de période conserve le cycle payé", () => {
  const state = polarSubscriptionState(
    subscription({ cancel_at_period_end: true }),
  );
  assert.equal(state.paidCycle, true);
});

test("seul un abonnement fini demande un nouveau paiement", () => {
  assert.equal(isEndedPolarSubscription(subscription({ status: "canceled" })), true);
  assert.equal(isEndedPolarSubscription(subscription({ status: "unpaid" })), true);
  assert.equal(isEndedPolarSubscription(subscription({ status: "past_due" })), false);
  assert.equal(
    isEndedPolarSubscription(subscription({ cancel_at_period_end: true })),
    false,
  );
});

test("un abonnement sans fin de période ne produit pas de date valide", () => {
  const state = polarSubscriptionState(
    subscription({ status: "canceled", current_period_end: null }),
  );
  assert.equal(state.endsAt, 0);
});

test("un produit inconnu est refusé", () => {
  assert.equal(planForPolarProduct("prod-business"), "business");
  assert.throws(() => planForPolarProduct("autre"), /UNKNOWN_POLAR_PRODUCT/);
});

test("le produit doit correspondre au tarif affiché", () => {
  assert.equal(matchesPolarProduct(product(), "starter"), true);
  assert.equal(matchesPolarProduct(product(), "pro"), false);
  assert.equal(
    matchesPolarProduct(product({ is_archived: true }), "starter"),
    false,
  );
  assert.equal(
    matchesPolarProduct(product({ recurring_interval: "year" }), "starter"),
    false,
  );
  assert.equal(
    matchesPolarProduct(product({ is_recurring: false }), "starter"),
    false,
  );
  assert.equal(
    matchesPolarProduct(
      product({
        prices: [
          {
            amount_type: "fixed",
            price_amount: 1599,
            price_currency: "eur",
            is_archived: false,
          },
        ],
      }),
      "starter",
    ),
    false,
  );
});

test("seuls les domaines de Polar sont acceptés pour quitter l'application", () => {
  assert.equal(isPolarCheckoutUrl("https://polar.sh/checkout/abc"), true);
  assert.equal(isPolarCheckoutUrl("https://sandbox.polar.sh/checkout/abc"), true);
  assert.equal(isPolarCheckoutUrl("http://polar.sh/checkout/abc"), false);
  assert.equal(isPolarCheckoutUrl("https://polar.sh.evil.test/abc"), false);
  assert.equal(isPolarCheckoutUrl("https://evilpolar.sh/abc"), false);
});
