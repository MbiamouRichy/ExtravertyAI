import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatStripeAmount,
  stripeDocumentUrl,
  billingStatusLabel,
} from "../lib/billing-display";
test("invoice amounts respect XAF and ordinary minor units", () => {
  assert.equal(
    formatStripeAmount(15000, "xaf"),
    new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "XAF",
    }).format(15000),
  );
  assert.equal(
    formatStripeAmount(1599, "eur"),
    new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(15.99),
  );
  assert.equal(
    formatStripeAmount(500, "isk"),
    new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "ISK",
    }).format(5),
  );
});
test("invoice document links reject non-Stripe origins and unsafe schemes", () => {
  assert.equal(
    stripeDocumentUrl("https://invoice.stripe.com/i/example"),
    "https://invoice.stripe.com/i/example",
  );
  for (const value of [
    "javascript:alert(1)",
    "https://stripe.com.evil.test/invoice",
    "https://evil.test",
    "http://invoice.stripe.com/i/test",
    "https://user:pass@invoice.stripe.com/i/test",
    "invalid",
  ])
    assert.equal(stripeDocumentUrl(value), null);
  assert.equal(billingStatusLabel("past_due"), "Paiement en retard");
});
