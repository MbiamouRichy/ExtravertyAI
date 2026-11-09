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
