import { test } from "node:test";
import assert from "node:assert/strict";
import { HISTORY_CHAR_BUDGET, fitHistory } from "../lib/ai-history";
import { aiMeter, readAiUsage } from "../lib/ai-usage";
import { generateReply } from "../lib/ai-jobs";
import { AgentConfigSchema } from "../lib/agent-config";
import {
  aiCostAlertUsd,
  loadAiCosts,
  monthKey,
  parseCostMonth,
  shiftMonth,
} from "../lib/admin-ai-costs";
import { countEntryWords, wordsToPages } from "../lib/knowledge-shared";
import { createProject, withTestDatabase } from "./helpers/database";

const message = (content: string) => ({ role: "user", content });

test("the history keeps the newest messages within the character budget", () => {
  const long = "x".repeat(4096);
  const history = Array.from({ length: 50 }, (_, index) => message(`${index}:${long}`));
  const kept = fitHistory(history);
  // 50 messages de 4 Ko : seuls les deux derniers tiennent dans 12 000 caractères.
  assert.equal(HISTORY_CHAR_BUDGET, 12_000);
  assert.deepEqual(kept, history.slice(-2));
  assert.ok(kept.reduce((total, item) => total + item.content.length, 0) <= HISTORY_CHAR_BUDGET);

  // Court, l’historique passe tel quel ; le dernier message reste même trop long.
  const short = [message("Bonjour"), message("Vous livrez ?")];
  assert.deepEqual(fitHistory(short), short);
  assert.deepEqual(fitHistory([message("a".repeat(20_000))]).length, 1);
  // On coupe au premier message qui dépasse : pas de trou dans la conversation.
  const gap = [message("a"), message("b".repeat(11_000)), message("c".repeat(2_000))];
  assert.deepEqual(fitHistory(gap), gap.slice(-1));
});

test("provider usage is read for chat and transcription payloads", () => {
  assert.deepEqual(
    readAiUsage(
      {
        model: "google/gemini-2.5-flash-lite",
        usage: {
          prompt_tokens: 10_250,
          completion_tokens: 180,
          prompt_tokens_details: { cached_tokens: 4_000 },
          cost: 0.00109,
        },
      },
      "fallback/model",
    ),
    {
      model: "google/gemini-2.5-flash-lite",
      promptTokens: 10_250,
      completionTokens: 180,
      cachedTokens: 4_000,
      costMicros: 1090,
    },
  );
  assert.deepEqual(
    readAiUsage(
      { text: "Bonjour", usage: { cost: 0.000508, input_tokens: 83, output_tokens: 30, seconds: 9.2 } },
      "openai/whisper-large-v3-turbo",
    ),
    {
      model: "openai/whisper-large-v3-turbo",
      promptTokens: 83,
      completionTokens: 30,
      cachedTokens: 0,
      costMicros: 508,
    },
  );
  // Sans usage communiqué : l’appel est compté, son coût reste inconnu.
  assert.deepEqual(readAiUsage({ usage: { cost: "1", prompt_tokens: -4 } }, "m"), {
    model: "m",
    promptTokens: 0,
    completionTokens: 0,
    cachedTokens: 0,
    costMicros: null,
  });
  assert.equal(readAiUsage(null, "m").costMicros, null);
});

test("a measure refused by the database never interrupts the call", async () => {
  const failing = {
    aiUsage: { create: async () => Promise.reject(new Error("FK violation")) },
  } as unknown as Parameters<typeof aiMeter>[0];
  await assert.doesNotReject(aiMeter(failing, "project", "reply")({ usage: { cost: 1 } }, "m"));
});

test("a generated reply reports the provider usage to its meter", async () => {
  const original = { fetch: globalThis.fetch, key: process.env.OPENROUTER_API_KEY, model: process.env.OPENROUTER_MODEL };
  process.env.OPENROUTER_API_KEY = "test-key";
  process.env.OPENROUTER_MODEL = "test/model";
  const payload = {
    model: "test/model",
    choices: [{ message: { content: "Oui, nous livrons à Libreville." } }],
    usage: { prompt_tokens: 900, completion_tokens: 12, cost: 0.0001 },
  };
  globalThis.fetch = (async () => Response.json(payload)) as typeof fetch;
  try {
    const seen: unknown[] = [];
    const config = AgentConfigSchema.parse({
      agentName: "Awa",
      agentSystemMessage: "Tu vends des chaussures à Libreville et tu réponds aux clients.",
      agentTone: "warm",
      agentResponseLength: "concise",
      agentLanguage: "auto",
      agentUseEmojis: false,
      agentQualifyLeads: true,
      agentAskOneQuestion: true,
      agentHumanHandover: true,
    });
    const reply = await generateReply([message("Vous livrez ?")], "Boutique", "Client", config, {
      meter: async (body, model) => void seen.push({ body, model }),
    });
    assert.equal(reply, "Oui, nous livrons à Libreville.");
    assert.deepEqual(seen, [{ body: payload, model: "test/model" }]);
  } finally {
    globalThis.fetch = original.fetch;
    // Affecter undefined écrirait la chaîne « undefined » dans l’environnement.
    if (original.key === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = original.key;
    if (original.model === undefined) delete process.env.OPENROUTER_MODEL;
    else process.env.OPENROUTER_MODEL = original.model;
  }
});

test("knowledge words and pages are counted like the database", () => {
  assert.equal(countEntryWords({ title: "Livrez-vous ?", content: "\n Oui,  en 48 h.\t" }), 6);
  assert.equal(countEntryWords({ title: " ", content: "" }), 0);
  assert.deepEqual([20_000, 150_000, 600_000].map(wordsToPages), [40, 300, 1200]);
});

test("cost months are bounded and the alert threshold has a default", () => {
  const now = new Date("2027-02-14T10:00:00Z");
  assert.equal(monthKey(now), "2027-02");
  assert.equal(parseCostMonth("2027-01", now), "2027-01");
  assert.equal(parseCostMonth("2027-05", now), "2027-02");
  assert.equal(parseCostMonth("2020-01", now), "2026-11");
  assert.equal(parseCostMonth("abc", now), "2027-02");
  assert.equal(shiftMonth("2027-01", -1), "2026-12");
  assert.equal(aiCostAlertUsd(undefined), 5);
  assert.equal(aiCostAlertUsd("12.5"), 12.5);
  assert.equal(aiCostAlertUsd("-3"), 5);
});

test("AI usage is recorded per project and summed for the back-office", { timeout: 120000 }, async () => {
  await withTestDatabase(async (prisma) => {
    const heavy = await createProject(prisma, { plan: "pro" });
    const light = await createProject(prisma);
    const usage = (cost: number | undefined, prompt = 1000) => ({
      usage: { prompt_tokens: prompt, completion_tokens: 50, ...(cost === undefined ? {} : { cost }) },
    });
    const reply = aiMeter(prisma, heavy.id, "reply");
    await reply(usage(4), "m");
    await reply(usage(2), "m");
    await aiMeter(prisma, heavy.id, "summary")(usage(0.5, 3000), "m");
    await aiMeter(prisma, light.id, "reply")(usage(0.001), "m");
    await aiMeter(prisma, light.id, "audio")(usage(undefined, 80), "whisper");
    assert.equal(await prisma.aiUsage.count(), 5);

    const month = monthKey(new Date());
    const report = await loadAiCosts(prisma, month, { thresholdUsd: 5 });
    assert.equal(report.totals.calls, 5);
    assert.equal(report.totals.unpriced, 1);
    assert.equal(report.totals.costMicros, 6_501_000);
    assert.equal(report.totals.promptTokens, 6080);
    assert.equal(report.projectCount, 2);
    assert.equal(report.overThreshold, 1);
    assert.deepEqual(
      report.projects.map((row) => [row.projectId, row.costMicros, row.replies, row.overThreshold]),
      [
        [heavy.id, 6_500_000, 2, true],
        [light.id, 1000, 1, false],
      ],
    );
    assert.equal(report.features[0].feature, "reply");
    assert.equal(report.features[0].calls, 3);
    // Coût moyen d’une réponse : 6,001 $ pour 3 réponses facturées.
    assert.equal(Math.round(report.costPerReplyMicros ?? 0), 2_000_333);
    assert.equal(report.previousCostMicros, 0);

    // Un projet supprimé garde son coût dans le total, sans nom.
    await prisma.project.delete({ where: { id: light.id } });
    const after = await loadAiCosts(prisma, month);
    assert.equal(after.totals.costMicros, 6_501_000);
    assert.equal(after.projects.at(-1)?.name, "Projet supprimé");
  });
});
