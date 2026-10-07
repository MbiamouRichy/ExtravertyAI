import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assessProspect,
  INSTINCT_MODELS,
  selectInstinctModel,
} from "../lib/instinct-decision";
import { currentProspectClassification } from "../lib/instinct-classification";

const goals = "Vendre des sites web professionnels";
const history = [
  {
    senderType: "CLIENT",
    type: "TEXT",
    content: "Je souhaite un devis pour mon site.",
  },
];
function answer(
  choice = "interesting",
  probabilities = { interesting: 1, follow_up: 0, none: 0 },
) {
  return {
    answers: {
      classification: { type: "choice", choice, probabilities, confidence: 1 },
    },
  };
}

test("instinct routes complete context and validates Decisions responses", async (t) => {
  const originalFetch = globalThis.fetch;
  const oldKey = process.env.OPENROUTER_API_KEY;
  const oldModel = process.env.OPENROUTER_MODEL;
  process.env.OPENROUTER_API_KEY = "test";
  delete process.env.OPENROUTER_MODEL;
  try {
    await t.test(
      "skips missing goals, agent-only messages, empty text and media",
      async () => {
        globalThis.fetch = async () => {
          throw new Error("Unexpected network request");
        };
        assert.equal(await assessProspect("", history), "none");
        assert.equal(
          await assessProspect(goals, [{ ...history[0], senderType: "BOT" }]),
          "none",
        );
        assert.equal(
          await assessProspect(goals, [{ ...history[0], type: "IMAGE" }]),
          "none",
        );
        assert.equal(
          await assessProspect(goals, [{ ...history[0], content: " " }]),
          "none",
        );
      },
    );
    await t.test(
      "Jev uses Decisions independently of the chat model for all three classes",
      async () => {
        for (const choice of ["interesting", "follow_up", "none"] as const) {
          globalThis.fetch = async (url, init) => {
            assert.equal(url, "https://openrouter.ai/api/alpha/decisions");
            const body = JSON.parse(String(init?.body));
            assert.equal(body.model, INSTINCT_MODELS.primary);
            assert.deepEqual(body.state, { goals, history });
            assert.equal(body.questions.classification.type, "choice");
            const probabilities = { interesting: 0, follow_up: 0, none: 0 };
            probabilities[choice] = 1;
            return Response.json(answer(choice, probabilities));
          };
          assert.equal(await assessProspect(goals, history), choice);
        }
      },
    );
    await t.test(
      "long context goes directly to Luna without clipping the final refusal",
      async () => {
        const longHistory = [
          { ...history[0], content: "Ancien intérêt. ".repeat(6000) },
          { ...history[0], content: "Finalement, j’annule." },
        ];
        let calls = 0;
        globalThis.fetch = async (_url, init) => {
          calls++;
          const body = JSON.parse(String(init?.body));
          assert.equal(body.model, INSTINCT_MODELS.overflow);
          assert.deepEqual(body.state.history, longHistory);
          return Response.json(
            answer("none", { interesting: 0, follow_up: 0, none: 1 }),
          );
        };
        assert.equal(await assessProspect(goals, longHistory), "none");
        assert.equal(calls, 1);
      },
    );
    await t.test(
      "routing counts goals, formatting and UTF-8; oversized inputs are refused",
      () => {
        assert.equal(
          selectInstinctModel({ goals, history }),
          INSTINCT_MODELS.primary,
        );
        assert.equal(
          selectInstinctModel({ goals: "é".repeat(20000), history }),
          INSTINCT_MODELS.overflow,
        );
        assert.throws(
          () => selectInstinctModel({ goals, history: "x".repeat(900000) }),
          /CONTEXT_TOO_LARGE/,
        );
      },
    );
    await t.test(
      "explicit context rejection retries once with identical state on Luna",
      async () => {
        for (const status of [400, 413, 422]) {
          const requests: Array<{ model: string; state: unknown }> = [];
          globalThis.fetch = async (_url, init) => {
            requests.push(JSON.parse(String(init?.body)));
            return requests.length === 1
              ? Response.json(
                  { error: { code: "context_length_exceeded" } },
                  { status },
                )
              : Response.json(answer());
          };
          assert.equal(await assessProspect(goals, history), "interesting");
          assert.deepEqual(
            requests.map((r) => r.model),
            [INSTINCT_MODELS.primary, INSTINCT_MODELS.overflow],
          );
          assert.deepEqual(requests[0].state, requests[1].state);
        }
      },
    );
    await t.test(
      "unrelated API errors do not trigger paid fallback",
      async () => {
        for (const status of [400, 401, 402, 422, 429, 500]) {
          let calls = 0;
          globalThis.fetch = async () => {
            calls++;
            return Response.json({ error: "unavailable" }, { status });
          };
          await assert.rejects(
            assessProspect(goals, history),
            /PROVIDER_ERROR/,
          );
          assert.equal(calls, 1);
        }
      },
    );
    await t.test("second context error stops rather than looping", async () => {
      let calls = 0;
      globalThis.fetch = async () => {
        calls++;
        return new Response(null, { status: 413 });
      };
      await assert.rejects(assessProspect(goals, history));
      assert.equal(calls, 2);
    });
    await t.test(
      "invalid and refused decisions are errors, never non-prospects",
      async () => {
        for (const payload of [
          {},
          answer("invented"),
          answer("none"),
          answer("interesting", {
            interesting: 0.2,
            follow_up: 0.1,
            none: 0.1,
          }),
          { answers: { classification: { type: "refusal" } } },
          answer("interesting", { interesting: 2, follow_up: 0, none: 0 }),
        ]) {
          let calls = 0;
          globalThis.fetch = async () => {
            calls++;
            return Response.json(payload);
          };
          await assert.rejects(assessProspect(goals, history));
          assert.equal(calls, 1);
        }
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (oldKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = oldKey;
    if (oldModel === undefined) delete process.env.OPENROUTER_MODEL;
    else process.env.OPENROUTER_MODEL = oldModel;
  }
});

test("only current enabled assessments are exposed to the chat", () => {
  const contact = {
    instinctClassification: "follow_up" as const,
    instinctSourceId: "m1",
    instinctConfigVersion: 2,
    project: { agentQualifyLeads: true, agentConfigVersion: 2 },
  };
  assert.equal(currentProspectClassification(contact, "m1"), "follow_up");
  assert.equal(currentProspectClassification(contact, "m2"), null);
  assert.equal(currentProspectClassification(contact, undefined), null);
  assert.equal(
    currentProspectClassification(
      { ...contact, instinctConfigVersion: 1 },
      "m1",
    ),
    null,
  );
  assert.equal(
    currentProspectClassification(
      { ...contact, project: { ...contact.project, agentQualifyLeads: false } },
      "m1",
    ),
    null,
  );
  assert.equal(
    currentProspectClassification(
      { ...contact, instinctClassification: null },
      "m1",
    ),
    null,
  );
  assert.equal(
    currentProspectClassification(
      { ...contact, instinctClassification: "none" },
      "m1",
    ),
    "none",
  );
});
