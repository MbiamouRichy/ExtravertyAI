import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildHelpSearchIndex,
  getAdjacentHelpArticles,
  getHelpNavigation,
  getHelpToc,
  helpReadingMinutes,
  isHelpArticleSlug,
} from "../lib/help-center/articles";
import { HELP_ARTICLES, type HelpBlock } from "../lib/help-center/content";
import { HELP_SLUG_PATTERN, HelpFeedbackInputSchema } from "../lib/help-center/feedback-shared";
import { inlineToMarkdown, inlineToWhatsApp, parseInline } from "../lib/help-center/inline";
import { helpCenterToMarkdown, helpStepToWhatsApp } from "../lib/help-center/markdown";
import { searchHelpIndex } from "../lib/help-center/search";
import { formatPlanPrice, PRICING_PLANS, TRIAL_DAYS, TRIAL_MESSAGES } from "../lib/pricing";

function texts(block: HelpBlock): string[] {
  switch (block.type) {
    case "p":
      return [block.text];
    case "steps":
    case "bullets":
    case "checklist":
      return block.items;
    case "callout":
    case "example":
      return [block.title, block.text];
    case "figure":
      return [block.caption, block.description];
    case "table":
      return [...block.head, ...block.rows.flat(), block.note ?? ""];
    case "faq":
      return block.items.flatMap((item) => [item.question, item.answer]);
    case "next":
      return block.items.flatMap((item) => [item.title, item.text]);
  }
}

test("every help article has a valid, unique slug and unique section anchors", () => {
  const slugs = HELP_ARTICLES.map((article) => article.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const article of HELP_ARTICLES) {
    // Même règle que la contrainte help_feedback_slug_check de la base.
    assert.match(article.slug, HELP_SLUG_PATTERN);
    const ids = article.sections.map((section) => section.id);
    assert.equal(new Set(ids).size, ids.length, `ancres en double dans ${article.slug}`);
    for (const id of ids) assert.match(id, /^[a-z0-9-]+$/);
    assert.ok(helpReadingMinutes(article) >= 1);
    assert.ok(getHelpToc(article).length === article.sections.length);
  }
  // Chaque article figure une seule fois dans la navigation.
  const navigated = getHelpNavigation().flatMap((group) => group.articles.map((article) => article.slug));
  assert.deepEqual([...navigated].sort(), [...slugs].sort());
});

test("help links and cross references point to existing pages", () => {
  for (const article of HELP_ARTICLES) {
    for (const section of article.sections) {
      for (const block of section.blocks) {
        if (block.type === "next")
          for (const item of block.items) assert.ok(isHelpArticleSlug(item.slug), `lien mort vers ${item.slug}`);
        for (const text of texts(block)) {
          for (const token of parseInline(text)) {
            assert.ok(!(token.type === "text" && /\]\(/.test(token.value)), `lien mal formé : ${token.value}`);
            if (token.type === "link" && token.href.startsWith("/aide/")) {
              const slug = token.href.slice("/aide/".length).split("#")[0];
              assert.ok(isHelpArticleSlug(slug), `lien mort vers ${token.href}`);
            }
          }
        }
      }
    }
  }
});

test("the guide follows the current sign-up and project creation flow", () => {
  const guide = HELP_ARTICLES.find((article) => article.slug === "demarrer")!;
  const steps = guide.sections.filter((section) => section.step);
  assert.deepEqual(
    steps.map((section) => section.step!.number),
    [1, 2, 3, 4, 5],
  );
  const all = guide.sections.flatMap((section) => section.blocks.flatMap(texts)).join("\n");
  // Inscription par code reçu par e-mail, mot de passe facultatif.
  assert.match(all, /\[\[Créer mon compte\]\]/);
  assert.match(all, /\[\[Ajouter un mot de passe \(facultatif\)\]\]/);
  assert.match(all, /\[\[Continuer avec Google\]\]/);
  // Création de projet : libellé et bouton actuels.
  assert.match(all, /Nom du projet \(Entreprise\)/);
  assert.match(all, /\[\[Vérifier mon numéro\]\]/);
  assert.doesNotMatch(all, /\[\[Plan\]\]/);
  // Les six écrans de la configuration de l’assistant.
  for (const screen of ["entreprise", "objectifs", "profil", "mission", "connaissances", "test"])
    assert.ok(guide.sections.some((section) => section.id === screen), `écran ${screen} absent`);
});

test("plan figures come from the pricing source", () => {
  const plans = HELP_ARTICLES.find((article) => article.slug === "forfaits")!;
  const table = plans.sections.flatMap((section) => section.blocks).find((block) => block.type === "table");
  assert.ok(table && table.type === "table");
  assert.deepEqual(table.head.slice(1), PRICING_PLANS.map((plan) => plan.name));
  assert.deepEqual(table.rows[0].slice(1), PRICING_PLANS.map((plan) => formatPlanPrice(plan.priceCents)));
  const markdown = helpCenterToMarkdown();
  assert.ok(markdown.includes(`${TRIAL_DAYS} jours ou ${TRIAL_MESSAGES} messages, selon ce qui arrive en premier`));
});

test("inline markup never produces an unsafe link", () => {
  assert.deepEqual(parseInline("Voir [ici](javascript:alert(1)) et [[Continuer]]"), [
    { type: "text", value: "Voir " },
    { type: "text", value: "[ici](javascript:alert(1)" },
    { type: "text", value: ") et " },
    { type: "ui", value: "Continuer" },
  ]);
  assert.equal(parseInline("[x](http://exemple.test)")[0].type, "text");
  assert.equal(parseInline("[x](/aide/demarrer#etape-1)")[0].type, "link");
  assert.equal(inlineToMarkdown("[guide](/aide/demarrer)"), "[guide](https://www.extravertyai.com/aide/demarrer)");
  assert.equal(inlineToWhatsApp("Touchez [[Continuer]] puis **validez**."), "Touchez *Continuer* puis *validez*.");
});

test("WhatsApp step texts are numbered and use WhatsApp bold", () => {
  const guide = HELP_ARTICLES.find((article) => article.slug === "demarrer")!;
  const text = helpStepToWhatsApp(guide.sections.find((section) => section.id === "etape-1")!);
  assert.match(text, /^\*Étape 1 : Créer votre compte\*\n1\. /);
  assert.doesNotMatch(text, /\*\*|\[\[/);
});

test("the committed Markdown export is up to date", async () => {
  const committed = (await readFile("docs/centre-aide.md", "utf8")).replace(/\r\n/g, "\n");
  assert.equal(committed, helpCenterToMarkdown(), "Lancez « npm run help:export » après avoir modifié l’aide.");
});

test("search ignores accents and ranks titles first", () => {
  const index = buildHelpSearchIndex();
  assert.equal(searchHelpIndex(index, "equipe roles")[0]?.href, "/aide/equipe");
  assert.ok(searchHelpIndex(index, "QR code").some((entry) => entry.href === "/aide/demarrer#etape-5"));
  assert.ok(searchHelpIndex(index, "mot de passe").some((entry) => entry.href === "/aide/compte"));
  assert.deepEqual(searchHelpIndex(index, "   "), []);
  assert.deepEqual(searchHelpIndex(index, "zzzz introuvable"), []);
});

test("adjacent articles follow the sidebar order", () => {
  const first = getHelpNavigation()[0].articles[0].slug;
  assert.equal(getAdjacentHelpArticles(first).previous, undefined);
  assert.ok(getAdjacentHelpArticles(first).next);
  assert.deepEqual(getAdjacentHelpArticles("inconnu"), { previous: undefined, next: undefined });
});

test("a positive vote never keeps a reason or a comment", () => {
  assert.deepEqual(
    HelpFeedbackInputSchema.parse({ articleSlug: "demarrer", helpful: true, reason: "OTHER", comment: "x" }),
    { articleSlug: "demarrer", helpful: true, reason: null, comment: null },
  );
  assert.deepEqual(
    HelpFeedbackInputSchema.parse({ articleSlug: "demarrer", helpful: false, reason: "MISSING_STEP", comment: "  " }),
    { articleSlug: "demarrer", helpful: false, reason: "MISSING_STEP", comment: null },
  );
  assert.equal(HelpFeedbackInputSchema.safeParse({ articleSlug: "../admin", helpful: false }).success, false);
  assert.equal(
    HelpFeedbackInputSchema.safeParse({ articleSlug: "demarrer", helpful: false, comment: "x".repeat(501) }).success,
    false,
  );
  assert.equal(HelpFeedbackInputSchema.safeParse({ articleSlug: "demarrer", helpful: false, reason: "AUTRE" }).success, false);
});
