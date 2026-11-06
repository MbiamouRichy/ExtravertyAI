export type BillingProvider = "stripe" | "polar";

/** Fournisseur des nouveaux paiements. Les abonnements existants gardent le leur. */
export function checkoutProvider(): BillingProvider {
  return process.env.BILLING_PROVIDER === "polar" ? "polar" : "stripe";
}
