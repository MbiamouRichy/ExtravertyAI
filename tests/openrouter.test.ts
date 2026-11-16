import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fallbackModel,
  openRouterChat,
  OpenRouterBodyError,
  resetOpenRouterBreakers,
} from "../lib/openrouter";
import { generateReply, trimToLastSentence } from "../lib/ai-jobs";
import { AGENT_DEFAULTS, REPLY_MAX_TOKENS } from "../lib/agent-config";

const PRIMARY = "google/gemini-2.5-flash-lite";
const BACKUP = "openai/gpt-6-luna";
const SECRET = "Mon numéro est le 077 00 00 00";

const ok = (content: string, finish = "stop") =>
  Response.json({ model: "served", choices: [{ finish_reason: finish, message: { content } }] });

type Handler = (model: string, signal: AbortSignal | undefined) => Response | Promise<Response>;

async function withProvider(handler: Handler, run: (calls: string[], logs: unknown[][]) => Promise<void>) {
  const saved = {
    fetch: globalThis.fetch,
    warn: console.warn,
    error: console.error,
    key: process.env.OPENROUTER_API_KEY,
    model: process.env.OPENROUTER_MODEL,
    backup: process.env.OPENROUTER_FALLBACK_MODEL,
  };
  const calls: string[] = [];
  const logs: unknown[][] = [];
  process.env.OPENROUTER_API_KEY = "test-key";
  process.env.OPENROUTER_MODEL = PRIMARY;
  process.env.OPENROUTER_FALLBACK_MODEL = BACKUP;
  console.warn = (...args: unknown[]) => void logs.push(args);
  console.error = (...args: unknown[]) => void logs.push(args);
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    assert.equal(String(url), "https://openrouter.ai/api/v1/chat/completions");
    const model = JSON.parse(String(init?.body)).model;
    calls.push(model);
    return handler(model, init?.signal ?? undefined);
  }) as typeof fetch;
  resetOpenRouterBreakers();
  try {
    await run(calls, logs);
  } finally {
    globalThis.fetch = saved.fetch;
    console.warn = saved.warn;
    console.error = saved.error;
    resetOpenRouterBreakers();
    for (const [name, value] of [
      ["OPENROUTER_API_KEY", saved.key],
      ["OPENROUTER_MODEL", saved.model],
      ["OPENROUTER_FALLBACK_MODEL", saved.backup],
    ] as const) {
      // Affecter undefined écrirait la chaîne « undefined » dans l’environnement.
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

const chat = (timeoutMs = 1000) =>
  openRouterChat({
    feature: "reply",
    model: PRIMARY,
    timeoutMs,
    body: { messages: [{ role: "user", content: SECRET }] },
  });

test("the fallback answers only when the main model is unavailable", async (t) => {
  for (const status of [408, 429, 500, 502, 503, 504]) {
    await t.test(`HTTP ${status} switches to the fallback`, () =>
      withProvider(
        (model) => (model === PRIMARY ? new Response("upstream error", { status }) : ok("Oui.")),
        async (calls, logs) => {
          const result = await chat();
          assert.equal(result.status, 200);
          assert.equal(result.model, BACKUP);
          assert.deepEqual(calls, [PRIMARY, BACKUP]);
          // Une ligne sans contenu client ni corps d’erreur du fournisseur.
          assert.equal(logs.length, 1);
          assert.doesNotMatch(JSON.stringify(logs), /077|numéro|upstream/);
          assert.match(JSON.stringify(logs), new RegExp(`HTTP_${status}`));
        },
      ),
    );
  }

  await t.test("a timeout or a network failure switches to the fallback", () =>
    withProvider(
      (model, signal) =>
        model === PRIMARY
          ? new Promise<Response>((_, reject) =>
              signal?.addEventListener("abort", () => reject(signal.reason)),
            )
          : ok("Oui."),
      async (calls, logs) => {
        assert.equal((await chat(20)).model, BACKUP);
        assert.deepEqual(calls, [PRIMARY, BACKUP]);
        assert.match(JSON.stringify(logs), /TIMEOUT/);
      },
    ),
  );

  await t.test("a generation interrupted by the provider switches too", () =>
    withProvider(
      (model) => (model === PRIMARY ? ok("Bon", "error") : ok("Bonjour !")),
      async (calls) => {
        assert.equal((await chat()).model, BACKUP);
        assert.deepEqual(calls, [PRIMARY, BACKUP]);
      },
    ),
  );

  for (const status of [400, 401, 402, 403, 404, 413, 422]) {
    await t.test(`HTTP ${status} never switches: the same key would fail`, () =>
      withProvider(
        (model) => (model === PRIMARY ? new Response("", { status }) : ok("Oui.")),
        async (calls) => {
          const result = await chat();
          assert.equal(result.status, status);
          assert.equal(result.payload, undefined);
          assert.deepEqual(calls, [PRIMARY]);
        },
      ),
    );
  }

  await t.test("a refused or filtered answer never switches", () =>
    withProvider(
      (model) =>
        model === PRIMARY
          ? Response.json({ choices: [{ finish_reason: "content_filter", message: { refusal: "Non." } }] })
          : ok("Contournement"),
      async (calls) => {
        const result = await chat();
        assert.equal(result.model, PRIMARY);
        assert.equal(result.payload?.choices?.[0]?.finish_reason, "content_filter");
        assert.deepEqual(calls, [PRIMARY]);
      },
    ),
  );

  await t.test("an unreadable answer is an error, not an outage", () =>
    withProvider(
      (model) => (model === PRIMARY ? new Response("pas du JSON") : ok("Oui.")),
      async (calls) => {
        await assert.rejects(chat(), OpenRouterBodyError);
        assert.deepEqual(calls, [PRIMARY]);
      },
    ),
  );

  await t.test("when both fail, the main model's failure is reported for a later retry", () =>
    withProvider(
      (model) => new Response("", { status: model === PRIMARY ? 503 : 400 }),
      async (calls, logs) => {
        assert.equal((await chat()).status, 503);
        assert.deepEqual(calls, [PRIMARY, BACKUP]);
        assert.equal(logs.length, 2);
      },
    ),
  );

  await t.test("without a fallback, the main model's answer is returned as before", () =>
    withProvider(
      () => new Response("", { status: 503 }),
      async (calls) => {
        delete process.env.OPENROUTER_FALLBACK_MODEL;
        assert.equal((await chat()).status, 503);
        assert.deepEqual(calls, [PRIMARY]);
      },
    ),
  );
});

test("after three outages in a minute, the fallback answers directly for a while", () =>
  withProvider(
    (model) => (model === PRIMARY ? new Response("", { status: 503 }) : ok("Oui.")),
    async (calls, logs) => {
      for (let index = 0; index < 3; index += 1) await chat();
      assert.deepEqual(calls, [PRIMARY, BACKUP, PRIMARY, BACKUP, PRIMARY, BACKUP]);
      calls.length = 0;
      logs.length = 0;
      assert.equal((await chat()).model, BACKUP);
      assert.deepEqual(calls, [BACKUP]);
      assert.equal(logs.length, 0);
    },
  ),
);

test("the fallback setting is validated", () =>
  withProvider(
    () => ok("Oui."),
    async (_calls, logs) => {
      assert.equal(fallbackModel(PRIMARY), BACKUP);
      process.env.OPENROUTER_FALLBACK_MODEL = PRIMARY;
      assert.equal(fallbackModel(PRIMARY), null);
      process.env.OPENROUTER_FALLBACK_MODEL = "https://evil.example/model";
      assert.equal(fallbackModel(PRIMARY), null);
      process.env.OPENROUTER_FALLBACK_MODEL = " ";
      assert.equal(fallbackModel(PRIMARY), null);
      assert.ok(logs.length <= 1);
    },
  ),
);

test("a reply uses its word budget, no reasoning, and a cache-friendly prompt", async () => {
  let request: Record<string, unknown> & { messages: Array<{ content: string }> } = { messages: [] };
  let answer = () => ok("Oui, nous livrons à Libreville.");
  const saved = {
    fetch: globalThis.fetch,
    key: process.env.OPENROUTER_API_KEY,
    model: process.env.OPENROUTER_MODEL,
    backup: process.env.OPENROUTER_FALLBACK_MODEL,
  };
  process.env.OPENROUTER_API_KEY = "test-key";
  process.env.OPENROUTER_MODEL = PRIMARY;
  delete process.env.OPENROUTER_FALLBACK_MODEL;
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    request = JSON.parse(String(init?.body));
    return answer();
  }) as typeof fetch;
  try {
    const config = {
      ...AGENT_DEFAULTS,
      agentName: "Awa",
      agentSystemMessage: "Tu vends des chaussures à Libreville et tu réponds aux clients.",
    };
    const reply = (length: "concise" | "balanced" | "detailed", extras = {}) =>
      generateReply([{ role: "user", content: "Vous livrez ?" }], "Boutique", "Awa N.", { ...config, agentResponseLength: length }, extras);
    for (const length of ["concise", "balanced", "detailed"] as const) {
      await reply(length);
      assert.equal(request.max_tokens, REPLY_MAX_TOKENS[length]);
    }
    assert.deepEqual([REPLY_MAX_TOKENS.concise, REPLY_MAX_TOKENS.balanced, REPLY_MAX_TOKENS.detailed], [200, 350, 550]);
    assert.deepEqual(request.reasoning, { enabled: false });
    assert.match(request.messages[0].content, /300 mots/);

    // Le début du prompt ne dépend ni du contact ni de la consigne ponctuelle.
    await reply("concise", { knowledge: "\n## Données de référence\nLivraison 48 h", avoid: "\nNe répète pas." });
    const system = request.messages[0].content;
    assert.ok(system.indexOf("Livraison 48 h") < system.indexOf("Awa N."));
    assert.ok(system.indexOf("Awa N.") < system.indexOf("Ne répète pas."));

    // Une réponse coupée par le plafond n’est jamais envoyée au milieu d’un mot.
    answer = () => ok("Oui, nous livrons à Libreville en 48 h. Pour Port-Gentil, comp", "length");
    assert.equal(await reply("concise"), "Oui, nous livrons à Libreville en 48 h.");
  } finally {
    globalThis.fetch = saved.fetch;
    for (const [name, value] of [
      ["OPENROUTER_API_KEY", saved.key],
      ["OPENROUTER_MODEL", saved.model],
      ["OPENROUTER_FALLBACK_MODEL", saved.backup],
    ] as const) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test("a truncated reply ends on its last complete sentence", () => {
  assert.equal(trimToLastSentence("Bonjour ! Nous livrons partout. Les frais sont de 3"), "Bonjour ! Nous livrons partout.");
  assert.equal(trimToLastSentence("Voici nos horaires :\nLundi 8 h - 18 h\nMardi 8 h"), "Voici nos horaires :\nLundi 8 h - 18 h");
  // Une seule phrase très courte au début : on garde le texte, sans mot coupé.
  assert.equal(trimToLastSentence("Oui. Nous proposons des sites vitrines, des boutiques en lig"), "Oui. Nous proposons des sites vitrines, des boutiques en…");
  assert.equal(trimToLastSentence("Merci beaucoup !"), "Merci beaucoup !");
});
