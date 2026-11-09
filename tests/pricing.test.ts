import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type Stripe from "stripe";
import { matchesCheckoutPrice } from "../lib/checkout-price";
import { PLAN_FEATURES, planAllows } from "../lib/plan-features";
import {
  PLAN_CAPABILITIES,
  PRICING_PLANS,
  pricingPlan,
  projectPlanHref,
  resolvePlanId,
} from "../lib/pricing";
import { MATRIX_GROUPS } from "../components/website/vitrine/data";

test("every pricing list follows the plan gates enforced on the server", () => {
  const rows = MATRIX_GROUPS.flatMap((group) => group.rows);
  const matrix = (label: string) => {
    const row = rows.find((candidate) => candidate.label === label);
    assert.ok(row, `ligne « ${label} » absente de la matrice`);
    return row.values;
  };
  const digits = (text: string) => text.replace(/\s/g, "");

  for (const plan of PRICING_PLANS) {
    const pipeline = planAllows(plan.id, "pipeline");
    // Carte de l'offre, liste complète (création de projet) et matrice du site.
    assert.equal(plan.features.some((line) => /pipeline/i.test(line)), pipeline, `${plan.id} : carte`);
    assert.equal(
      PLAN_CAPABILITIES[plan.id].some((line) => /pipeline/i.test(line)),
      pipeline,
      `${plan.id} : liste complète`,
    );
    assert.equal(matrix("Pipeline de prospects")[plan.id], pipeline);

    // Instinct IA : annoncé exactement sur les offres où le serveur l’active.
    const instinct = planAllows(plan.id, "instinct");
    assert.equal(
      plan.features.some((line) => /Instinct|qualification des prospects/i.test(line)),
      instinct,
      `${plan.id} : Instinct sur la carte`,
    );
    assert.equal(
      PLAN_CAPABILITIES[plan.id].some((line) => /Instinct/i.test(line)),
      instinct,
      `${plan.id} : Instinct dans la liste complète`,
    );
    assert.equal(matrix("Instinct IA : prospects repérés")[plan.id], instinct);

    // Notes vocales et images : comprises exactement sur les offres qui les annoncent.
    for (const [feature, pattern, label] of [
      ["audio", /notes vocales/i, "Compréhension des notes vocales"],
      ["images", /images/i, "Compréhension des images"],
    ] as const) {
      const allowed = planAllows(plan.id, feature);
      assert.equal(
        plan.features.some((line) => pattern.test(line)),
        allowed,
        `${plan.id} : ${feature} sur la carte`,
      );
      assert.equal(
        PLAN_CAPABILITIES[plan.id].some((line) => pattern.test(line)),
        allowed,
        `${plan.id} : ${feature} dans la liste complète`,
      );
      assert.equal(matrix(label)[plan.id], allowed, `${plan.id} : ${feature} dans la matrice`);
    }

    // Résumé IA, répartition automatique et rapports : annoncés là où le serveur les autorise.
    for (const [feature, cardPattern, fullPattern, label] of [
      ["summary", /Résumé IA/, /Résumé IA/, "Résumé IA des conversations"],
      [
        "autoAssign",
        /Répartition automatique/,
        /Répartition automatique/,
        "Répartition automatique des conversations",
      ],
      ["reports", /rapports/i, /Rapports hebdomadaires/, "Rapports hebdomadaires programmés"],
    ] as const) {
      const allowed = planAllows(plan.id, feature);
      assert.equal(
        plan.features.some((line) => cardPattern.test(line)),
        allowed,
        `${plan.id} : ${feature} sur la carte`,
      );
      assert.equal(
        PLAN_CAPABILITIES[plan.id].some((line) => fullPattern.test(line)),
        allowed,
        `${plan.id} : ${feature} dans la liste complète`,
      );
      assert.equal(matrix(label)[plan.id], allowed, `${plan.id} : ${feature} dans la matrice`);
    }

    // Utilisateurs et historique : la carte et la matrice disent ce que le serveur applique.
    assert.ok(
      plan.features[0].startsWith(`${plan.users} utilisateurs`),
      `${plan.id} : utilisateurs sur la carte`,
    );
    assert.equal(matrix("Utilisateurs")[plan.id], String(plan.users));
    const history = matrix("Historique des statistiques")[plan.id];
    assert.equal(
      history,
      { 30: "30 jours", 90: "90 jours", 365: "12 mois" }[PLAN_FEATURES[plan.id].analyticsDays],
    );
    assert.ok(
      (plan.features as readonly string[]).includes(`Statistiques sur ${history}`),
      `${plan.id} : historique sur la carte`,
    );

    assert.equal(matrix("Questionnaire de satisfaction")[plan.id], planAllows(plan.id, "csat"));
    assert.equal(
      matrix("Connexion à vos outils (Make, Zapier, CRM)")[plan.id],
      planAllows(plan.id, "webhooks"),
    );

    // Les limites de diffusion écrites en toutes lettres suivent PLAN_FEATURES.
    const limits = PLAN_FEATURES[plan.id];
    const card = plan.features.find((line) => line.startsWith("Diffusion"));
    const full = PLAN_CAPABILITIES[plan.id].find((line) => line.startsWith("Diffusion"));
    assert.equal(Boolean(card), limits.broadcast, `${plan.id} : diffusion sur la carte`);
    assert.equal(Boolean(full), limits.broadcast, `${plan.id} : diffusion dans la liste`);
    assert.equal(Boolean(matrix("Diffusion de messages")[plan.id]), limits.broadcast);
    if (card && full) {
      for (const value of [limits.broadcastRecipients, limits.broadcastMonthly]) {
        assert.ok(digits(card).includes(String(value)), `${plan.id} : ${value} sur la carte`);
      }
      for (const value of [limits.broadcastRecipients, limits.broadcastMonthly, limits.broadcastDaily]) {
        assert.ok(digits(full).includes(String(value)), `${plan.id} : ${value} dans la liste`);
      }
    }
  }

  // Quota mensuel : appliqué depuis MESSAGE_LIMIT_<OFFRE>, dont l’exemple suit les tarifs.
  const example = readFileSync(new URL("../.env.example", import.meta.url), "utf8");
  for (const plan of PRICING_PLANS) {
    const configured = example.match(
      new RegExp(`^MESSAGE_LIMIT_${plan.id.toUpperCase()}=(\\d+)\\s*$`, "m"),
    );
    assert.equal(Number(configured?.[1]), plan.messageLimit, `${plan.id} : quota de messages`);
  }

  // La carte de l'accueil n'affiche que quatre lignes : celle de Business montre le pipeline.
  assert.match(pricingPlan("business").features.slice(0, 4).join(" · "), /Pipeline/);
  assert.equal(pricingPlan("inconnu").id, "starter");
});

test("pricing links preserve each selected plan through the sign-in callback", () => {
  for (const plan of PRICING_PLANS) {
    const href = projectPlanHref(plan.id);
    const signIn = new URL(`/sign-in?callbackUrl=${encodeURIComponent(href)}`, "https://example.test");
    const destination = new URL(signIn.searchParams.get("callbackUrl")!, signIn.origin);
    assert.equal(destination.pathname, "/projects/new");
    assert.equal(resolvePlanId(destination.searchParams.get("plan")), plan.id);
  }
  for (const invalid of [undefined, "unknown", ["pro", "business"], "__proto__", "https://example.com"]) {
    assert.equal(resolvePlanId(invalid), "starter");
  }
});

test("checkout rejects stale prices, wrong currencies and billing intervals", () => {
  for (const plan of PRICING_PLANS) {
    const price = {
      active: true, currency: "usd", unit_amount: plan.priceCents,
      billing_scheme: "per_unit", type: "recurring", transform_quantity: null,
      recurring: { interval: "month", interval_count: 1, usage_type: "licensed" },
    } as Stripe.Price;
    assert.equal(matchesCheckoutPrice(price, plan.id), true);
    for (const override of [
      { active: false }, { currency: "eur" }, { unit_amount: 2900 },
      { billing_scheme: "tiered" }, { recurring: null }, { type: "one_time" },
      { recurring: { ...price.recurring, interval: "year" } },
      { recurring: { ...price.recurring, interval_count: 3 } },
      { recurring: { ...price.recurring, usage_type: "metered" } },
      { transform_quantity: { divide_by: 10, round: "up" } },
    ]) {
      assert.equal(matchesCheckoutPrice({ ...price, ...override } as Stripe.Price, plan.id), false);
    }
  }
});
