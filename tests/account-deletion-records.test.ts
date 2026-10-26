import assert from "node:assert/strict";
import { test } from "node:test";
import {
  hashDeletedEmail,
  hashFeedbackToken,
} from "../lib/account-deletion-records";
import { DeletionFeedbackSchema } from "../lib/deletion-feedback";

test("deletion records store a keyed, normalized hash instead of the e-mail", () => {
  process.env.BETTER_AUTH_SECRET = "test-secret";
  const hash = hashDeletedEmail("  Jane.Doe@Example.com ");
  assert.equal(hash, hashDeletedEmail("jane.doe@example.com"));
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.ok(!hash.includes("jane"));
  process.env.BETTER_AUTH_SECRET = "other-secret";
  assert.notEqual(hashDeletedEmail("jane.doe@example.com"), hash);
});

test("feedback tokens are only stored hashed", () => {
  assert.match(hashFeedbackToken("token"), /^[0-9a-f]{64}$/);
  assert.notEqual(hashFeedbackToken("token"), "token");
});

test("exit survey accepts known reasons and bounded comments only", () => {
  assert.ok(DeletionFeedbackSchema.safeParse({ reason: "too_expensive", comment: "" }).success);
  assert.ok(!DeletionFeedbackSchema.safeParse({ reason: "<script>", comment: "" }).success);
  assert.ok(!DeletionFeedbackSchema.safeParse({ reason: "other", comment: "x".repeat(501) }).success);
});
