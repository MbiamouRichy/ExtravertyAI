import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkPolarEnvironment,
  checkPolarWebhooks,
  REQUIRED_POLAR_EVENTS,
} from "../lib/polar-readiness";

const production = {
  POLAR_SERVER: "",
  POLAR_ACCESS_TOKEN: "polar_oat_live",
  POLAR_WEBHOOK_SECRET: "whsec_live",
  POLAR_STARTER_PRODUCT_ID: "p1",
  POLAR_PRO_PRODUCT_ID: "p2",
  POLAR_BUSINESS_PRODUCT_ID: "p3",
  NEXT_PUBLIC_APP_URL: "https://www.extravertyai.com",
};
const failures = (env: Record<string, string | undefined>) =>
  checkPolarEnvironment(env).filter((finding) => !finding.ok).map((finding) => finding.label);

test("une configuration de production complète passe", () => {
  assert.deepEqual(failures(production), []);
});

test("le sandbox, un produit manquant ou en double, une adresse de préversion sont refusés", () => {
  assert.ok(failures({ ...production, POLAR_SERVER: "sandbox" }).some((label) => label.includes("POLAR_SERVER")));
  assert.ok(failures({ ...production, POLAR_PRO_PRODUCT_ID: "" }).length > 0);
  assert.ok(failures({ ...production, POLAR_PRO_PRODUCT_ID: "p1" }).includes("Un produit différent par offre"));
  assert.ok(failures({ ...production, NEXT_PUBLIC_APP_URL: "https://x-git-codex.vercel.app" }).length > 0);
  assert.ok(failures({ ...production, NEXT_PUBLIC_APP_URL: "http://www.extravertyai.com" }).length > 0);
  assert.ok(failures({ ...production, POLAR_SANDBOX_ACCESS_TOKEN: "polar_oat_live" }).length > 0);
  assert.ok(failures({ ...production, POLAR_WEBHOOK_SECRET: undefined }).length > 0);
});

test("le webhook doit viser l’adresse exacte, en Raw, avec tous les événements", () => {
  const url = "https://www.extravertyai.com/api/webhooks/polar";
  const good = { url, format: "raw", events: [...REQUIRED_POLAR_EVENTS, "checkout.created"] };
  assert.ok(checkPolarWebhooks([good], "https://www.extravertyai.com/").every((finding) => finding.ok));
  // Sans www : Polar suivrait une redirection et compterait un échec.
  assert.equal(checkPolarWebhooks([{ ...good, url: "https://extravertyai.com/api/webhooks/polar" }], "https://www.extravertyai.com")[0].ok, false);
  assert.ok(checkPolarWebhooks([{ ...good, format: "slack" }], "https://www.extravertyai.com").some((finding) => !finding.ok));
  const partial = checkPolarWebhooks([{ ...good, events: ["order.paid"] }], "https://www.extravertyai.com");
  assert.match(partial.find((finding) => !finding.ok)?.detail ?? "", /subscription\.revoked/);
});
