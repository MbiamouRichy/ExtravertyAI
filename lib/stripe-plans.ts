// lib/stripe-plans.ts
export const PLANS = {
  STARTER: {
    name: "Plan Starter",
    priceId: "price_1Tv1tLFowWBAojOvu5Bz1Z3Z",
  },
  PRO: {
    name: "Plan Pro",
    priceId: process.env.STRIPE_PRO_PLAN_ID || "",
  },
  BUSINESS: {
    name: "Plan Business",
    priceId: process.env.STRIPE_BUSINESS_PLAN_ID || "",
  },
} as const;
