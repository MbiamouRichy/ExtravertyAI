import type Stripe from "stripe";
import type { PolarProduct } from "./polar";
import { PRICING_PLANS, type PlanId } from "./pricing";

export function matchesPolarProduct(product: PolarProduct, planId: PlanId) {
  const plan = PRICING_PLANS.find((candidate) => candidate.id === planId)!;
  return (
    !product.is_archived &&
    product.is_recurring &&
    product.recurring_interval === "month" &&
    (product.recurring_interval_count ?? 1) === 1 &&
    product.prices.some(
      (price) =>
        !price.is_archived &&
        price.amount_type === "fixed" &&
        price.price_currency === "usd" &&
        price.price_amount === plan.priceCents,
    )
  );
}

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
