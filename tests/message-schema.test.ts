import { test } from "node:test";
import assert from "node:assert/strict";
import { MessageContentSchema } from "../lib/message-schema";

test("manual messages accept 10,000 words, including more than 4,096 characters", () => {
  const content = Array(10_000).fill("bonjour").join(" ");
  assert.equal(MessageContentSchema.parse(content), content);
  assert.equal(MessageContentSchema.safeParse(content + " bonjour").success, false);
});

test("word limits count tabs, line breaks and non-breaking spaces as separators", () => {
  const content = Array(10_000).fill("bonjour").join("\n\t\u00a0");
  assert.equal(MessageContentSchema.safeParse(content).success, true);
  assert.equal(MessageContentSchema.safeParse(content + "\tbonjour").success, false);
});

test("manual messages normalize outer whitespace and reject empty drafts", () => {
  assert.equal(MessageContentSchema.parse("  Bonjour\nà tous  "), "Bonjour\nà tous");
  assert.equal(MessageContentSchema.safeParse(" \n\t ").success, false);
});
