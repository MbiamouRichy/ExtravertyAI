import { test } from "node:test";
import assert from "node:assert/strict";

import { agentClockInstruction } from "../lib/agent-clock";
import { generateReply } from "../lib/ai-jobs";
import { AgentConfigSchema } from "../lib/agent-config";

// Mardi 24 novembre 2026, 19 h 15 UTC : 20 h 15 à Libreville (UTC+1).
const EVENING = new Date("2026-11-24T19:15:00Z");

test("the assistant gets the project's date and time", () => {
  const line = agentClockInstruction("Africa/Libreville", EVENING);
  assert.match(line, /fuseau Africa\/Libreville/);
  assert.match(line, /mardi 24 novembre 2026/);
  assert.match(line, /20:15/);
});

test("the date follows the project's zone across midnight", () => {
  const late = new Date("2026-11-24T23:30:00Z");
  const line = agentClockInstruction("Africa/Libreville", late);
  assert.match(line, /mercredi 25 novembre 2026/);
  assert.match(line, /00:30/);
  assert.match(agentClockInstruction("Africa/Abidjan", late), /mardi 24 novembre 2026.*23:30/);
});

test("an unknown zone falls back to Libreville", () => {
  for (const zone of ["Mars/Olympus", "", null, undefined, 42]) {
    const line = agentClockInstruction(zone, EVENING);
    assert.match(line, /fuseau Africa\/Libreville/);
    assert.match(line, /20:15/);
  }
});

test("the reply prompt carries the clock after the knowledge and before the contact", async () => {
  const original = { fetch: globalThis.fetch, key: process.env.OPENROUTER_API_KEY, model: process.env.OPENROUTER_MODEL };
  process.env.OPENROUTER_API_KEY = "test-key";
  process.env.OPENROUTER_MODEL = "test/model";
  const bodies: Array<{ messages: Array<{ role: string; content: string }> }> = [];
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    return Response.json({
      model: "test/model",
      choices: [{ message: { content: "Demain 10 h vous convient ?" } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, cost: 0 },
    });
  }) as typeof fetch;
  try {
    const config = AgentConfigSchema.parse({
      agentName: "Verty",
      agentSystemMessage: "Tu proposes des créneaux d'installation aux e-commerçants.",
      agentTone: "warm",
      agentResponseLength: "concise",
      agentLanguage: "auto",
      agentUseEmojis: false,
      agentQualifyLeads: true,
      agentAskOneQuestion: true,
      agentHumanHandover: true,
    });
    await generateReply([{ role: "user", content: "Bonsoir" }], "Support", "Awa", config, {
      knowledge: "\n\nCONNAISSANCES\nInstallation en 15 minutes.",
      timeZone: "Africa/Libreville",
      now: EVENING,
    });
    const system = bodies[0]?.messages.find((message) => message.role === "system")?.content ?? "";
    const clock = system.indexOf(agentClockInstruction("Africa/Libreville", EVENING));
    assert.ok(clock > system.indexOf("Installation en 15 minutes."), "après les connaissances");
    assert.ok(clock < system.indexOf("Nom du contact"), "avant le nom du contact");
  } finally {
    globalThis.fetch = original.fetch;
    if (original.key === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = original.key;
    if (original.model === undefined) delete process.env.OPENROUTER_MODEL;
    else process.env.OPENROUTER_MODEL = original.model;
  }
});
