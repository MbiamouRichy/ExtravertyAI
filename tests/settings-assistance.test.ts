import assert from "node:assert/strict";
import { test } from "node:test";
import { signExportReceipt, verifyExportReceipt } from "../lib/contact-export";
import { AGENT_DEFAULTS } from "../lib/agent-config";
import { generateSystemMessage } from "../lib/system-message-assistance";
import { reserveSystemAssistance } from "../lib/system-assistance-limits";
import type { Prisma } from "../src/generated/prisma/client";

test("export proofs bind the user, project, complete snapshot, format and expiry", () => {
  const secret = process.env.BETTER_AUTH_SECRET;
  process.env.BETTER_AUTH_SECRET = "test-secret-for-export-proof";
  try {
    const expected = {
      userId: "alice",
      projectId: "a",
      hash: "snapshot",
      format: "csv" as const,
    };
    const proof = signExportReceipt(expected, 1000000);
    assert.equal(verifyExportReceipt(proof, expected, 1000001), true);
    assert.equal(verifyExportReceipt(proof, expected, 1600000), false);
    for (const change of [
      { userId: "bob" },
      { projectId: "b" },
      { hash: "changed" },
      { format: "xlsx" as const },
    ])
      assert.equal(
        verifyExportReceipt(proof, { ...expected, ...change }, 1000001),
        false,
      );
    assert.equal(verifyExportReceipt(proof + "x", expected, 1000001), false);
    assert.equal(
      verifyExportReceipt(proof + ".extra", expected, 1000001),
      false,
    );
  } finally {
    if (secret === undefined) delete process.env.BETTER_AUTH_SECRET;
    else process.env.BETTER_AUTH_SECRET = secret;
  }
});

test("system-message generation uses configured model, bounded tokens and rejects incomplete output", async () => {
  const original = globalThis.fetch;
  const key = process.env.OPENROUTER_API_KEY,
    model = process.env.OPENROUTER_MODEL;
  process.env.OPENROUTER_API_KEY = "test";
  process.env.OPENROUTER_MODEL = "google/gemini-test";
  let reason = "stop",
    content = JSON.stringify({
      systemMessage:
        "Tu représentes une boutique et aides les prospects sans inventer de prix.",
    });
  try {
    globalThis.fetch = async (_url, options) => {
      const request = JSON.parse(String(options?.body));
      assert.equal(request.model, "google/gemini-test");
      assert.equal(request.max_tokens, 6000);
      assert.equal(request.messages[0].role, "system");
      assert.match(request.messages[0].content, /ne rien inventer/i);
      assert.equal(
        JSON.parse(request.messages[1].content).projectName,
        "Boutique",
      );
      return Response.json({
        choices: [{ finish_reason: reason, message: { content } }],
      });
    };
    const input = {
      mode: "generate" as const,
      projectName: "Boutique",
      config: { ...AGENT_DEFAULTS, agentName: "Nova" },
    };
    assert.match(await generateSystemMessage(input), /boutique/);
    reason = "length";
    await assert.rejects(generateSystemMessage(input));
    reason = "stop";
    content = '{"systemMessage":"trop court"}';
    await assert.rejects(generateSystemMessage(input));
    content = "invalid JSON";
    await assert.rejects(generateSystemMessage(input));
    content = JSON.stringify({ systemMessage: "x".repeat(12001) });
    await assert.rejects(generateSystemMessage(input));
    globalThis.fetch = async () => new Response("x".repeat(160001));
    await assert.rejects(generateSystemMessage(input));
  } finally {
    globalThis.fetch = original;
    if (key === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = key;
    if (model === undefined) delete process.env.OPENROUTER_MODEL;
    else process.env.OPENROUTER_MODEL = model;
  }
});

test("AI limits reserve before spending and reject parallel, rapid, daily and unauthorized requests", async () => {
  const now = new Date();
  let writes = 0;
  const locks: string[] = [];
  let role = "OWNER";
  let rows: {
    projectId: string;
    actorId: string;
    state: string;
    createdAt: Date;
  }[] = [];
  const tx = {
    $queryRaw: async (parts: TemplateStringsArray) => {
      const sql = parts.join("?");
      if (sql.includes("clock_timestamp")) return [{ now }];
      if (sql.includes("FROM ai_editor_request")) return rows;
      locks.push(sql);
      return [{ id: "id" }];
    },
    projectMembership: {
      findUnique: async () => ({
        role,
        project: { name: "Boutique", deletionPending: false },
      }),
    },
    $executeRaw: async (parts: TemplateStringsArray) => {
      if (parts.join("").includes("INSERT")) writes++;
      return 1;
    },
  } as unknown as Prisma.TransactionClient;
  await reserveSystemAssistance(tx, "project", "user");
  assert.equal(writes, 1);
  assert.match(locks[0], /user.*FOR UPDATE/);
  assert.match(locks[1], /project.*FOR UPDATE/);
  const row = {
    projectId: "project",
    actorId: "user",
    state: "completed",
    createdAt: new Date(now.getTime() - 60000),
  };
  rows = [{ ...row, state: "started" }];
  await assert.rejects(
    reserveSystemAssistance(tx, "project", "user"),
    /en cours/,
  );
  rows = [{ ...row, createdAt: new Date(now.getTime() - 29999) }];
  await assert.rejects(
    reserveSystemAssistance(tx, "project", "user"),
    /30 secondes/,
  );
  rows = Array.from({ length: 10 }, () => row);
  await assert.rejects(
    reserveSystemAssistance(tx, "project", "user"),
    /Limite/,
  );
  rows = Array.from({ length: 20 }, () => ({ ...row, projectId: "other" }));
  await assert.rejects(
    reserveSystemAssistance(tx, "project", "user"),
    /Limite/,
  );
  rows = [];
  role = "AGENT";
  await assert.rejects(
    reserveSystemAssistance(tx, "project", "user"),
    /droits/,
  );
  assert.equal(writes, 1);
});
