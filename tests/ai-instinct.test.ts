import { test } from "node:test";
import assert from "node:assert/strict";
import { assessProspect } from "../lib/ai-instinct";

test("instinct requires client context and evidence and rejects malformed assessments", async () => {
  assert.equal(await assessProspect("", []), false);
  assert.equal(
    await assessProspect("Vendre des logiciels", [
      { senderType: "BOT", type: "TEXT", content: "Un devis ?" },
    ]),
    false,
  );
  const originalFetch = globalThis.fetch;
  const oldKey = process.env.OPENROUTER_API_KEY;
  const oldModel = process.env.OPENROUTER_MODEL;
  process.env.OPENROUTER_API_KEY = "test";
  process.env.OPENROUTER_MODEL = "test";
  const history = [
    {
      senderType: "CLIENT",
      type: "TEXT",
      content: "Je souhaite un devis pour votre logiciel.",
    },
  ];
  try {
    globalThis.fetch = async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      assert.equal(body.messages[0].role, "system");
      assert.deepEqual(JSON.parse(body.messages[1].content).history, history);
      return Response.json({
        choices: [
          {
            message: {
              content: '{"interesting":true,"evidence":"Demande de devis."}',
            },
          },
        ],
      });
    };
    assert.equal(await assessProspect("Vendre des logiciels", history), true);
    globalThis.fetch = async () =>
      Response.json({
        choices: [
          { message: { content: '{"interesting":true,"evidence":""}' } },
        ],
      });
    assert.equal(await assessProspect("Vendre des logiciels", history), false);
    for (const content of [
      '{"interesting":"true","evidence":"devis"}',
      "{}",
      "not json",
    ]) {
      globalThis.fetch = async () =>
        Response.json({ choices: [{ message: { content } }] });
      await assert.rejects(assessProspect("Vendre des logiciels", history));
    }
    globalThis.fetch = async () =>
      Response.json({
        choices: [
          {
            finish_reason: "length",
            message: { content: '{"interesting":true,"evidence":"devis"}' },
          },
        ],
      });
    await assert.rejects(assessProspect("Vendre des logiciels", history));
  } finally {
    globalThis.fetch = originalFetch;
    if (oldKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = oldKey;
    if (oldModel === undefined) delete process.env.OPENROUTER_MODEL;
    else process.env.OPENROUTER_MODEL = oldModel;
  }
});
