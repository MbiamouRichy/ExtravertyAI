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

test("the goodbye page opens only for a live token from a real deletion", async () => {
  const { default: prisma } = await import("../lib/prisma");
  const { findDeletionFeedbackSlot } = await import("../lib/account-deletion-records");
  const now = Date.now();
  const slots = new Map([
    [hashFeedbackToken("live"), { expiresAt: new Date(now + 60_000), submittedAt: null }],
    [hashFeedbackToken("answered"), { expiresAt: new Date(now + 60_000), submittedAt: new Date(now) }],
    [hashFeedbackToken("expired"), { expiresAt: new Date(now - 1), submittedAt: null }],
  ]);
  const lookups: string[] = [];
  Object.defineProperty(prisma, "accountDeletionFeedback", {
    configurable: true,
    value: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) => {
        lookups.push(where.tokenHash);
        return slots.get(where.tokenHash) ?? null;
      },
    },
  });

  assert.deepEqual(await findDeletionFeedbackSlot("live"), { answered: false });
  assert.deepEqual(await findDeletionFeedbackSlot("answered"), { answered: true });
  assert.equal(await findDeletionFeedbackSlot("expired"), null);
  assert.equal(await findDeletionFeedbackSlot("forged"), null);
  // Only the hash is ever looked up, never the raw token.
  assert.ok(!lookups.includes("live"));

  const before = lookups.length;
  assert.equal(await findDeletionFeedbackSlot(undefined), null);
  assert.equal(await findDeletionFeedbackSlot(""), null);
  assert.equal(await findDeletionFeedbackSlot("x".repeat(129)), null);
  assert.equal(lookups.length, before, "no lookup without a plausible token");
});
