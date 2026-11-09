import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assessProspect,
  INSTINCT_MODELS,
  selectInstinctModel,
} from "../lib/instinct-decision";
import {
  currentProspectClassification,
  instinctEnabled,
  lastProspectClassification,
} from "../lib/instinct-classification";
import { runInstinctCycle } from "../lib/ai-instinct";
import { integrationContact } from "../lib/integration-events";
import { planAllows, requiredPlanLabel } from "../lib/plan-features";
import {
  activateBilling,
  createProject,
  ingestText,
  withTestDatabase,
} from "./helpers/database";

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

test("the inbox keeps the last assessment until the next one", () => {
  const contact = {
    instinctClassification: "interesting" as const,
    project: { plan: "pro", agentQualifyLeads: true },
  };
  assert.equal(lastProspectClassification(contact), "interesting");
  assert.equal(
    lastProspectClassification({
      ...contact,
      project: { plan: "pro", agentQualifyLeads: false },
    }),
    null,
  );
  // Anciennes analyses d’un projet passé à Starter : plus affichées.
  assert.equal(
    lastProspectClassification({
      ...contact,
      project: { plan: "starter", agentQualifyLeads: true },
    }),
    null,
  );
});

test("Instinct IA is sold and enabled from Pro only", () => {
  assert.equal(planAllows("starter", "instinct"), false);
  assert.equal(planAllows("pro", "instinct"), true);
  assert.equal(planAllows("business", "instinct"), true);
  assert.equal(requiredPlanLabel("instinct"), "Pro ou Business");
  assert.equal(instinctEnabled({ plan: "starter", agentQualifyLeads: true }), false);
  assert.equal(instinctEnabled({ plan: "business", agentQualifyLeads: true }), true);
  assert.equal(instinctEnabled({ plan: "business", agentQualifyLeads: false }), false);
  // Valeur inconnue : retombe sur Starter, donc pas d’analyse.
  assert.equal(instinctEnabled({ plan: "enterprise", agentQualifyLeads: true }), false);
});

test("the Instinct worker analyses Pro projects and never Starter ones", async () => {
  await withTestDatabase(async (prisma) => {
    async function setup(plan: "starter" | "pro") {
      const { id } = await createProject(prisma, { plan });
      await activateBilling(prisma, id);
      await prisma.project.update({
        where: { id },
        data: { agentSetupCompletedAt: new Date(), agentSystemMessage: goals },
      });
      const contact = await ingestText(prisma, id, "Je souhaite un devis pour mon site.");
      return { id, contactId: contact.id };
    }
    const contact = (id: string) => prisma.contact.findUniqueOrThrow({ where: { id } });
    const starter = await setup("starter");
    const pro = await setup("pro");
    let starterCalls = 0;

    // Seul le contact Pro est analysé ; il ne reste ensuite plus aucun candidat.
    assert.equal(await runInstinctCycle(prisma, async () => "interesting"), pro.id);
    assert.equal(
      await runInstinctCycle(prisma, async () => {
        starterCalls += 1;
        return "interesting";
      }),
      null,
    );
    assert.equal(starterCalls, 0);
    assert.equal((await contact(pro.contactId)).instinctClassification, "interesting");
    const untouched = await contact(starter.contactId);
    assert.equal(untouched.instinctClassification, null);
    assert.equal(untouched.instinctLeaseToken, null);

    // Outils externes (Google Sheets, webhooks) : une ancienne analyse d’un
    // projet Starter ne sort jamais ; celle d’un projet Pro, oui.
    await prisma.contact.update({
      where: { id: starter.contactId },
      data: { instinctClassification: "interesting" },
    });
    const exported = (contactId: string) =>
      prisma.$transaction((tx) => integrationContact(tx, contactId));
    assert.equal((await exported(starter.contactId))?.instinct, null);
    assert.equal((await exported(pro.contactId))?.instinct, "interesting");

    // Passage à Starter pendant l’analyse : le résultat n’est pas enregistré.
    await ingestText(prisma, pro.id, "Finalement, je préfère réfléchir.");
    assert.equal(
      await runInstinctCycle(prisma, async () => {
        await prisma.project.update({ where: { id: pro.id }, data: { plan: "starter" } });
        return "none";
      }),
      null,
    );
    assert.equal((await contact(pro.contactId)).instinctClassification, "interesting");
    assert.equal(
      await runInstinctCycle(prisma, async () => {
        starterCalls += 1;
        return "none";
      }),
      null,
    );
    assert.equal(starterCalls, 0);
  });
});

test("only current enabled assessments are exposed to reports", () => {
  const contact = {
    instinctClassification: "follow_up" as const,
    instinctSourceId: "m1",
    instinctConfigVersion: 2,
    project: { plan: "pro", agentQualifyLeads: true, agentConfigVersion: 2 },
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
      { ...contact, project: { ...contact.project, plan: "starter" } },
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
