import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import type { LookupAddress } from "node:dns";
import {
  PlanFeatureError,
  minimumPlanFor,
  planAllows,
  planFeatures,
  planUpgradeMessage,
  plansWith,
  requirePlanFeature,
  requiredPlanLabel,
} from "../lib/plan-features";
import { wordsToPages } from "../lib/knowledge-shared";
import { PLAN_CAPABILITIES } from "../lib/pricing";
import { openSecret, sealSecret } from "../lib/secret-box";
import {
  SafeFetchError,
  createGuardedLookup,
  isBlockedAddress,
  parsePublicUrl,
} from "../lib/safe-fetch";

test("plan features gate pipeline, satisfaction and integrations", () => {
  // Pipeline de ventes : Business seulement ; la satisfaction reste dès Pro.
  assert.equal(planAllows("starter", "pipeline"), false);
  assert.equal(planAllows("pro", "pipeline"), false);
  assert.equal(planAllows("business", "pipeline"), true);
  assert.throws(() => requirePlanFeature("pro", "pipeline"), PlanFeatureError);
  assert.equal(planAllows("pro", "csat"), true);
  assert.equal(planAllows("pro", "integrations"), true);
  // Google Sheets pour toutes les offres, webhooks dès Pro.
  assert.equal(planAllows("starter", "integrations"), true);
  assert.equal(planAllows("starter", "webhooks"), false);
  assert.equal(planAllows("pro", "webhooks"), true);
  assert.equal(planAllows("business", "integrations"), true);
  // Mémoire de contexte : 20, 30 puis 50 derniers messages.
  assert.deepEqual(
    ["starter", "pro", "business"].map((plan) => planFeatures(plan).contextMessages),
    [20, 30, 50],
  );
  // Unknown plans fall back to the most restrictive one.
  assert.equal(planFeatures("enterprise").knowledgeWords, 20_000);
  // Volume de la base : ≈ 40, 300 puis 1 200 pages.
  assert.deepEqual(
    ["starter", "pro", "business"].map((plan) => planFeatures(plan).knowledgeWords),
    [20_000, 150_000, 600_000],
  );
  // Documents importés (PDF et pages web) : 5, 10 puis 20.
  assert.deepEqual(
    ["starter", "pro", "business"].map((plan) => planFeatures(plan).knowledgeSources),
    [5, 10, 20],
  );
  // La liste « Inclus dans … » de la création de projet suit ces limites.
  for (const plan of ["starter", "pro", "business"] as const) {
    const { knowledgeWords, knowledgeSources } = planFeatures(plan);
    const pages = wordsToPages(knowledgeWords).toLocaleString("fr-FR");
    assert.ok(
      PLAN_CAPABILITIES[plan].includes(
        `Base de connaissances : ≈ ${pages} pages, ${knowledgeSources} documents PDF ou pages web`,
      ),
      plan,
    );
  }
  assert.throws(() => requirePlanFeature("starter", "csat"), PlanFeatureError);
  assert.doesNotThrow(() => requirePlanFeature("business", "csat"));
});

test("upgrade messages name the plans that really unlock a feature", () => {
  assert.deepEqual(plansWith("pipeline"), ["business"]);
  assert.equal(minimumPlanFor("pipeline"), "business");
  assert.equal(requiredPlanLabel("pipeline"), "Business");
  assert.equal(
    planUpgradeMessage("pipeline"),
    "Le pipeline de prospects est disponible avec l’offre Business.",
  );
  assert.equal(minimumPlanFor("broadcast"), "pro");
  assert.equal(requiredPlanLabel("broadcast"), "Pro ou Business");
  assert.equal(requiredPlanLabel("csat"), "Pro ou Business");
  assert.equal(requiredPlanLabel("integrations"), "Starter, Pro ou Business");
  assert.throws(() => requirePlanFeature("pro", "pipeline"), /offre Business\./);
});

test("secret box round-trips and binds ciphertexts to their context", () => {
  process.env.INTEGRATIONS_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  const sealed = sealSecret("whsec_abc", "endpoint-1");
  assert.notEqual(sealed, "whsec_abc");
  assert.equal(openSecret(sealed, "endpoint-1"), "whsec_abc");
  assert.throws(() => openSecret(sealed, "endpoint-2"));
  const [version, iv, tag, body] = sealed.split(".");
  const flipped = body.slice(0, -1) + (body.endsWith("A") ? "B" : "A");
  assert.throws(() => openSecret([version, iv, tag, flipped].join("."), "endpoint-1"));
  // Two seals of the same value never match (random IV).
  assert.notEqual(sealSecret("x", "c"), sealSecret("x", "c"));
});

test("private, local and reserved addresses are blocked", () => {
  for (const address of [
    "127.0.0.1",
    "10.1.2.3",
    "172.20.0.1",
    "192.168.1.10",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "::1",
    "::",
    "fd00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "64:ff9b::a00:1",
    "not-an-ip",
  ]) {
    assert.equal(isBlockedAddress(address), true, address);
  }
  for (const address of ["8.8.8.8", "142.250.74.14", "2606:4700:4700::1111"]) {
    assert.equal(isBlockedAddress(address), false, address);
  }
});

test("only public https URLs on standard ports are accepted", () => {
  assert.equal(parsePublicUrl("https://hook.eu1.make.com/abc").hostname, "hook.eu1.make.com");
  for (const url of [
    "http://example.com",
    "https://user:pass@example.com",
    "https://example.com:22/",
    "ftp://example.com",
    "not a url",
  ]) {
    assert.throws(() => parsePublicUrl(url), (error: SafeFetchError) => error.code === "INVALID_URL", url);
  }
  for (const url of [
    "https://localhost/",
    "https://127.0.0.1/",
    "https://[::1]/",
    "https://metadata.google.internal/",
    "https://printer.local/",
    "https://intranet/",
  ]) {
    assert.throws(() => parsePublicUrl(url), (error: SafeFetchError) => error.code === "BLOCKED_ADDRESS", url);
  }
});

test("guarded lookup refuses a hostname with any private record", async () => {
  const resolveWith =
    (addresses: Array<{ address: string; family: number }>) => async () => addresses;
  const run = (
    addresses: Array<{ address: string; family: number }>,
    all: boolean,
  ) =>
    new Promise<{ error: unknown; address: string | LookupAddress[] }>((resolve) => {
      createGuardedLookup(resolveWith(addresses))("example.com", { all }, (error, address) =>
        resolve({ error, address }),
      );
    });

  const mixed = await run(
    [
      { address: "93.184.216.34", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ],
    false,
  );
  assert.ok(mixed.error instanceof SafeFetchError);
  assert.equal((mixed.error as SafeFetchError).code, "BLOCKED_ADDRESS");

  const single = await run([{ address: "93.184.216.34", family: 4 }], false);
  assert.equal(single.error, null);
  assert.equal(single.address, "93.184.216.34");

  const all = await run([{ address: "2606:4700::1111", family: 6 }], true);
  assert.deepEqual(all.address, [{ address: "2606:4700::1111", family: 6 }]);
});
