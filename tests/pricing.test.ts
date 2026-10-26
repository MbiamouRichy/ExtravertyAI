import assert from "node:assert/strict";
import { test } from "node:test";
import type Stripe from "stripe";
import { matchesCheckoutPrice } from "../lib/checkout-price";
import { PRICING_PLANS, projectPlanHref, resolvePlanId } from "../lib/pricing";

test("pricing links preserve each selected plan through the sign-in callback", () => {
  for (const plan of PRICING_PLANS) {
    const href = projectPlanHref(plan.id);
    const signIn = new URL(`/sign-in?callbackUrl=${encodeURIComponent(href)}`, "https://example.test");
    const destination = new URL(signIn.searchParams.get("callbackUrl")!, signIn.origin);
    assert.equal(destination.pathname, "/projects/new");
    assert.equal(resolvePlanId(destination.searchParams.get("plan")), plan.id);
  }
  for (const invalid of [undefined, "unknown", ["pro", "business"], "__proto__", "https://example.com"]) {
    assert.equal(resolvePlanId(invalid), "starter");
  }
});

test("checkout rejects stale prices, wrong currencies and billing intervals", () => {
  for (const plan of PRICING_PLANS) {
    const price = {
      active: true, currency: "usd", unit_amount: plan.priceCents,
      billing_scheme: "per_unit", type: "recurring", transform_quantity: null,
      recurring: { interval: "month", interval_count: 1, usage_type: "licensed" },
    } as Stripe.Price;
    assert.equal(matchesCheckoutPrice(price, plan.id), true);
    for (const override of [
      { active: false }, { currency: "eur" }, { unit_amount: 2900 },
      { billing_scheme: "tiered" }, { recurring: null }, { type: "one_time" },
      { recurring: { ...price.recurring, interval: "year" } },
      { recurring: { ...price.recurring, interval_count: 3 } },
      { recurring: { ...price.recurring, usage_type: "metered" } },
      { transform_quantity: { divide_by: 10, round: "up" } },
    ]) {
      assert.equal(matchesCheckoutPrice({ ...price, ...override } as Stripe.Price, plan.id), false);
    }
  }
});
