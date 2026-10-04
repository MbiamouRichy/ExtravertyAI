import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AssistanceInputSchema,
  generateWritingAssistance,
} from "../lib/writing-assistance";

test("rewriting requires a nonempty bounded draft and valid conversation identifiers", () => {
  const input = {
    projectId: "cl123456789012345678901234",
    contactId: "cl123456789012345678901235",
    mode: "rewrite",
    draft: " Bonjour ",
  };
  assert.equal(AssistanceInputSchema.safeParse(input).success, true);
  for (const draft of ["  ", "x".repeat(6001), undefined])
    assert.equal(
      AssistanceInputSchema.safeParse({ ...input, draft }).success,
      false,
    );
  assert.equal(
    AssistanceInputSchema.safeParse({ ...input, projectId: "invalid" }).success,
    false,
  );
});

test("provider receives contextual data separately and invalid or truncated responses are rejected", async () => {
  const originalFetch = globalThis.fetch;
  const oldKey = process.env.OPENROUTER_API_KEY;
  const oldModel = process.env.OPENROUTER_MODEL;
  process.env.OPENROUTER_API_KEY = "test";
  process.env.OPENROUTER_MODEL = "test";
  const input = {
    mode: "suggest" as const,
    history: [
      { senderType: "CLIENT", type: "TEXT", content: "Quel est le délai ?" },
    ],
    instructions: "Ne promettre aucun délai non confirmé.",
  };
  try {
    globalThis.fetch = async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      assert.equal(body.messages[0].role, "system");
      assert.deepEqual(JSON.parse(body.messages[1].content), input);
      assert.ok(init?.signal);
      return Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                replies: [
                  "Pour quel produit souhaitez-vous connaître le délai ?",
                ],
              }),
            },
          },
        ],
      });
    };
    assert.equal((await generateWritingAssistance(input)).length, 1);
    for (const replies of [
      [],
      [""],
      ["x".repeat(6001)],
      ["a", "b", "c", "d"],
    ]) {
      globalThis.fetch = async () =>
        Response.json({
          choices: [{ message: { content: JSON.stringify({ replies }) } }],
        });
      await assert.rejects(generateWritingAssistance(input));
    }
    globalThis.fetch = async () =>
      Response.json({
        choices: [
          {
            finish_reason: "length",
            message: { content: '{"replies":["Texte"]}' },
          },
        ],
      });
    await assert.rejects(generateWritingAssistance(input));
    globalThis.fetch = async () =>
      Response.json({
        choices: [{ message: { content: '{"replies":["A","B"]}' } }],
      });
    await assert.rejects(
      generateWritingAssistance({
        ...input,
        mode: "rewrite",
        draft: "Bonjour",
      }),
    );
    globalThis.fetch = async () => new Response(null, { status: 503 });
    await assert.rejects(generateWritingAssistance(input));
  } finally {
    globalThis.fetch = originalFetch;
    if (oldKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = oldKey;
    if (oldModel === undefined) delete process.env.OPENROUTER_MODEL;
    else process.env.OPENROUTER_MODEL = oldModel;
  }
});
