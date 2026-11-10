import { test } from "node:test";
import assert from "node:assert/strict";

import robots from "../app/robots";
import sitemap from "../app/sitemap";
import { PRICING_PLANS } from "../lib/pricing";
import { SITE_ALTERNATE_NAMES, SITE_URL } from "../lib/site";
import { homeStructuredData, serializeJsonLd } from "../lib/structured-data";

type Node = Record<string, unknown> & { "@type": string };

function node(type: string): Node {
  const found = (homeStructuredData()["@graph"] as Node[]).find(
    (item) => item["@type"] === type,
  );
  assert.ok(found, `nœud ${type} absent`);
  return found;
}

test("les données structurées relient les variantes de la marque", () => {
  for (const type of ["Organization", "WebSite", "SoftwareApplication"]) {
    const item = node(type);
    assert.equal(item.name, "ExtravertyAI");
    assert.deepEqual(item.alternateName, SITE_ALTERNATE_NAMES);
    assert.equal(item.url, SITE_URL);
  }
  assert.ok(SITE_ALTERNATE_NAMES.includes("Extraverty"));
});

test("les offres suivent les prix de lib/pricing", () => {
  const offers = node("SoftwareApplication").offers as Array<{ name: string; price: string }>;
  assert.deepEqual(
    offers.map(({ name, price }) => [name, price]),
    PRICING_PLANS.map((plan) => [plan.name, (plan.priceCents / 100).toFixed(2)]),
  );
});

test("la sérialisation ne peut pas fermer la balise script", () => {
  const json = serializeJsonLd({ text: "</script><script>alert(1)</script>" });
  assert.ok(!json.includes("<"));
  assert.deepEqual(JSON.parse(json), { text: "</script><script>alert(1)</script>" });
});

test("le sitemap ne liste que des adresses publiques et absolues", () => {
  const urls = sitemap().map((entry) => entry.url);
  assert.ok(urls.includes(SITE_URL));
  assert.ok(urls.every((url) => url.startsWith(`${SITE_URL}`)));
  assert.ok(!urls.some((url) => /\/(projects|admin|api|tarifs)\b/.test(url)));
});

test("robots.txt ferme l’espace connecté et indique le sitemap", () => {
  const result = robots();
  const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;
  for (const path of ["/admin", "/projects", "/api/"]) {
    assert.ok([rules.disallow].flat().includes(path), `${path} non bloqué`);
  }
  assert.equal(result.sitemap, `${SITE_URL}/sitemap.xml`);
});
