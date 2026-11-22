import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ALL_APP_HELP_LINKS,
  GUIDE_STEP_LINKS,
  HELP_CENTER_LINK,
  SETUP_STEP_LINKS,
  helpLinkForAppPath,
} from "../lib/help-center/app-links";
import { getHelpArticle } from "../lib/help-center/articles";

test("every help link opened from the app reaches an existing article or section, with its title", () => {
  for (const link of ALL_APP_HELP_LINKS) {
    if (link.href === HELP_CENTER_LINK.href) continue;
    const match = /^\/aide\/([a-z0-9-]+)(?:#([a-z0-9-]+))?$/.exec(link.href);
    assert.ok(match, `lien d’aide mal formé : ${link.href}`);
    const article = getHelpArticle(match[1]);
    assert.ok(article, `article absent : ${link.href}`);
    if (match[2]) {
      const section = article.sections.find((item) => item.id === match[2]);
      assert.ok(section, `section absente : ${link.href}`);
      assert.equal(link.title, section.title, `titre périmé pour ${link.href}`);
    } else {
      assert.equal(link.title, article.title, `titre périmé pour ${link.href}`);
    }
  }
});

test("each app page opens the matching help article", () => {
  const href = (path: string) => helpLinkForAppPath(path).href;
  assert.equal(href("/projects"), "/aide/demarrer");
  assert.equal(href("/projects/new?plan=pro"), GUIDE_STEP_LINKS.project.href);
  assert.equal(href("/projects/user"), "/aide/compte");
  assert.equal(href("/projects/abc123"), "/aide/statistiques");
  assert.equal(href("/projects/abc123/chat"), "/aide/messagerie");
  assert.equal(href("/projects/abc123/knowledge/42"), "/aide/connaissances");
  assert.equal(href("/projects/abc123/setup"), GUIDE_STEP_LINKS.setup.href);
  assert.equal(href("/projects/abc123/billing"), "/aide/abonnement");
  // Une page sans article dédié mène à l’accueil de l’aide, jamais à un article sans rapport.
  assert.equal(href("/projects/abc123/nouvelle-page"), HELP_CENTER_LINK.href);
  assert.equal(href("/admin"), HELP_CENTER_LINK.href);
  assert.equal(helpLinkForAppPath(null).href, HELP_CENTER_LINK.href);
  // Les six écrans de la configuration ont chacun leur section.
  assert.deepEqual(Object.keys(SETUP_STEP_LINKS), ["company", "goals", "profile", "mission", "knowledge", "test"]);
});
