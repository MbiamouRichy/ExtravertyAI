import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  buildCheckoutRequest,
  buildDodoSubscriptionUpdate,
  checkoutUrlFrom,
  summarizeEvent,
  verifyWebhookSignature,
} from "../lib/payment-sandbox";

const input = {
  plan: "starter" as const,
  projectId: "sandbox_1",
  email: "test@example.com",
  returnUrl: "http://localhost:4242/done",
};
const env = {
  POLAR_SANDBOX_ACCESS_TOKEN: "polar_token",
  POLAR_SANDBOX_STARTER_PRODUCT_ID: "polar_product",
  DODO_TEST_API_KEY: "dodo_test_key",
  DODO_TEST_STARTER_PRODUCT_ID: "dodo_product",
};

const secret = `whsec_${Buffer.from("cle-de-test").toString("base64")}`;
const NOW = 1_800_000_000_000;
const timestamp = String(NOW / 1000);
function sign(body: string, id = "msg_1", at = timestamp) {
  const signature = crypto
    .createHmac("sha256", Buffer.from("cle-de-test"))
    .update(`${id}.${at}.${body}`)
    .digest("base64");
  return `v1,${signature}`;
}

test("both checkouts target only test environments with a 10-day trial", () => {
  const polar = buildCheckoutRequest("polar", input, env);
  assert.equal(polar.url, "https://sandbox-api.polar.sh/v1/checkouts/");
  assert.deepEqual(polar.body.products, ["polar_product"]);
  assert.equal(polar.body.trial_interval_count, 10);
  assert.equal(polar.body.metadata.projectId, "sandbox_1");

  const dodo = buildCheckoutRequest("dodo", input, env);
  assert.equal(dodo.url, "https://test.dodopayments.com/checkouts");
  assert.deepEqual(dodo.body.subscription_data, { trial_period_days: 10 });
  assert.equal(dodo.body.metadata.projectId, "sandbox_1");
});

test("the trial can be shortened to reach the first paid cycle quickly", () => {
  const shortTrial = { ...env, PAYMENT_SANDBOX_TRIAL_DAYS: "1" };
  assert.equal(buildCheckoutRequest("polar", input, shortTrial).body.trial_interval_count, 1);
  assert.deepEqual(buildCheckoutRequest("dodo", input, shortTrial).body.subscription_data, {
    trial_period_days: 1,
  });
});

test("Polar order events report the subscription, not the order id", () => {
  const order = summarizeEvent("polar", {
    type: "order.paid",
    data: {
      id: "order_1",
      subscription_id: "sub_p",
      status: "paid",
      total_amount: 0,
      billing_reason: "subscription_create",
    },
  });
  assert.equal(order.subscriptionId, "sub_p");
  assert.equal(order.amount, 0);
  assert.equal(order.billingReason, "subscription_create");
});

test("Dodo test subscriptions can be billed early or canceled", () => {
  const now = Date.parse("2026-11-01T10:00:00.000Z");
  const soon = buildDodoSubscriptionUpdate(
    "sub_123",
    { action: "bill-soon", minutes: 3 },
    env,
    now,
  );
  assert.equal(soon.url, "https://test.dodopayments.com/subscriptions/sub_123");
  assert.deepEqual(soon.body, { next_billing_date: "2026-11-01T10:03:00.000Z" });
  assert.deepEqual(
    buildDodoSubscriptionUpdate("sub_123", { action: "cancel-now" }, env).body,
    { status: "cancelled" },
  );
  assert.deepEqual(
    buildDodoSubscriptionUpdate("sub_123", { action: "cancel-at-period-end" }, env).body,
    { cancel_at_next_billing_date: true },
  );
});

test("Dodo subscription changes refuse unsafe input and live keys", () => {
  const cancel = { action: "cancel-now" } as const;
  assert.throws(() => buildDodoSubscriptionUpdate("../payments", cancel, env), /invalide/);
  assert.throws(
    () => buildDodoSubscriptionUpdate("sub_1", { action: "bill-soon", minutes: 0 }, env),
    /minutes/,
  );
  assert.throws(
    () => buildDodoSubscriptionUpdate("sub_1", cancel, { ...env, DODO_TEST_API_KEY: "live_key" }),
    /clé de test/,
  );
});

test("a live Dodo key or a missing product is refused before any request", () => {
  assert.throws(
    () => buildCheckoutRequest("dodo", input, { ...env, DODO_TEST_API_KEY: "live_key" }),
    /clé de test/,
  );
  assert.throws(
    () => buildCheckoutRequest("polar", input, { ...env, POLAR_SANDBOX_STARTER_PRODUCT_ID: "" }),
    /POLAR_SANDBOX_STARTER_PRODUCT_ID/,
  );
});

test("the hosted checkout URL is read per provider and must be HTTPS", () => {
  assert.equal(checkoutUrlFrom("polar", { url: "https://a.test/x" }), "https://a.test/x");
  assert.equal(checkoutUrlFrom("dodo", { checkout_url: "https://b.test/y" }), "https://b.test/y");
  assert.throws(() => checkoutUrlFrom("dodo", { checkout_url: "http://b.test/y" }));
  assert.throws(() => checkoutUrlFrom("polar", null));
});

test("webhook signatures are verified on the exact raw body", () => {
  const body = '{"type":"subscription.active"}';
  const base = { secret, body, id: "msg_1", timestamp, nowMs: NOW };
  assert.equal(verifyWebhookSignature({ ...base, signature: sign(body) }), true);
  assert.equal(
    verifyWebhookSignature({ ...base, signature: `v1,invalide ${sign(body)}` }),
    true,
  );
  assert.equal(verifyWebhookSignature({ ...base, body: `${body} `, signature: sign(body) }), false);
  assert.equal(verifyWebhookSignature({ ...base, signature: "v1,AAAA" }), false);
  assert.equal(verifyWebhookSignature({ ...base, signature: undefined }), false);
  assert.equal(verifyWebhookSignature({ ...base, id: undefined, signature: sign(body) }), false);
});

test("replayed webhooks outside the 5-minute window are rejected", () => {
  const body = "{}";
  const old = String(NOW / 1000 - 301);
  assert.equal(
    verifyWebhookSignature({
      secret,
      body,
      id: "msg_1",
      timestamp: old,
      signature: sign(body, "msg_1", old),
      nowMs: NOW,
    }),
    false,
  );
});

test("event summaries expose billing fields and flag what is missing", () => {
  const polar = summarizeEvent("polar", {
    type: "subscription.active",
    data: {
      id: "sub_p",
      status: "trialing",
      current_period_start: "2026-11-01T00:00:00Z",
      current_period_end: "2026-11-11T00:00:00Z",
      trial_end: "2026-11-11T00:00:00Z",
      metadata: { projectId: "sandbox_1" },
      customer: { email: "secret@example.com" },
    },
  });
  assert.equal(polar.subscriptionId, "sub_p");
  assert.deepEqual(polar.missing, []);
  assert.equal(JSON.stringify(polar).includes("secret@example.com"), false);

  const dodo = summarizeEvent("dodo", {
    type: "subscription.active",
    data: { subscription_id: "sub_d", status: "active", next_billing_date: "2026-12-01T00:00:00Z" },
  });
  assert.deepEqual(dodo.missing, ["periodStart", "projectId"]);
  assert.deepEqual(summarizeEvent("dodo", { type: "payment.succeeded", data: {} }).missing, []);
});
