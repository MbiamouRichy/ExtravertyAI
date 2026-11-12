import assert from "node:assert/strict";
import { test } from "node:test";
import { formatBillingAmount, billingStatusLabel } from "../lib/billing-display";
test("invoice amounts respect XAF and ordinary minor units", () => {
  assert.equal(
    formatBillingAmount(15000, "xaf"),
    new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "XAF",
    }).format(15000),
  );
  assert.equal(
    formatBillingAmount(1599, "eur"),
    new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(15.99),
  );
  assert.equal(
    formatBillingAmount(500, "isk"),
    new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "ISK",
    }).format(5),
  );
});
test("subscription and order statuses have French labels", () => {
  assert.equal(billingStatusLabel("past_due"), "Paiement en retard");
  assert.equal(billingStatusLabel("paid"), "Payée");
  assert.equal(billingStatusLabel("unexpected"), "À vérifier");
});
