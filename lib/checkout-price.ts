import type Stripe from "stripe";
import { PRICING_PLANS, type PlanId } from "./pricing";

export function matchesCheckoutPrice(price: Stripe.Price, planId: PlanId) {
  const plan = PRICING_PLANS.find((candidate) => candidate.id === planId)!;
  return (
    price.active &&
    price.currency === "usd" &&
    price.unit_amount === plan.priceCents &&
    price.billing_scheme === "per_unit" &&
    price.type === "recurring" &&
    price.recurring?.interval === "month" &&
    price.recurring.interval_count === 1 &&
    price.recurring.usage_type === "licensed" &&
    !price.transform_quantity
  );
}
