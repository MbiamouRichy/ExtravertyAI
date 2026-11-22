import {
  HELP_ARTICLES,
  HELP_GROUPS,
  type HelpArticle,
  type HelpBlock,
  type HelpGroup,
} from "./content";
import { inlineToPlain } from "./inline";
import { normalizeHelpSearch, type HelpSearchEntry } from "./search";

export type { HelpSearchEntry } from "./search";

export const HELP_HOME_PATH = "/aide";
export const HELP_GUIDE_SLUG = "demarrer";

const BY_SLUG = new Map(HELP_ARTICLES.map((article) => [article.slug, article]));

export function helpArticleHref(slug: string, sectionId?: string) {
  return `${HELP_HOME_PATH}/${slug}${sectionId ? `#${sectionId}` : ""}`;
}

export function getHelpArticle(slug: string): HelpArticle | undefined {
  return BY_SLUG.get(slug);
}

export function isHelpArticleSlug(slug: string) {
  return BY_SLUG.has(slug);
}

export function getHelpGroup(id: HelpArticle["groupId"]): HelpGroup {
  const group = HELP_GROUPS.find((candidate) => candidate.id === id);
  if (!group) throw new Error(`Groupe d’aide inconnu : ${id}`);
  return group;
}

export type HelpNavGroup = HelpGroup & {
  articles: Pick<HelpArticle, "slug" | "title" | "plan">[];
};

/** Arborescence de la barre latérale, dans l’ordre de lecture. */
export function getHelpNavigation(): HelpNavGroup[] {
  return HELP_GROUPS.map((group) => ({
    ...group,
    articles: HELP_ARTICLES.filter((article) => article.groupId === group.id).map(
      ({ slug, title, plan }) => ({ slug, title, plan }),
    ),
  })).filter((group) => group.articles.length > 0);
}

/** Articles précédent et suivant, dans l’ordre de la barre latérale. */
export function getAdjacentHelpArticles(slug: string) {
  const ordered = getHelpNavigation().flatMap((group) => group.articles);
  const index = ordered.findIndex((article) => article.slug === slug);
  return {
    previous: index > 0 ? ordered[index - 1] : undefined,
    next: index >= 0 && index < ordered.length - 1 ? ordered[index + 1] : undefined,
  };
}

export type HelpTocEntry = { id: string; title: string; level: 2 | 3 };

export function getHelpToc(article: HelpArticle): HelpTocEntry[] {
  return article.sections.map((section) => ({
    id: section.id,
    title: section.step ? `${section.step.number}. ${section.title}` : section.title,
    level: section.level ?? 2,
  }));
}

function blockText(block: HelpBlock): string[] {
  switch (block.type) {
    case "p":
      return [block.text];
    case "steps":
    case "bullets":
    case "checklist":
      return block.items;
    case "callout":
      return [block.title, block.text];
    case "example":
      return [block.title, block.text];
    case "figure":
      return [block.caption, block.description];
    case "table":
      return [block.caption, ...block.head, ...block.rows.flat(), block.note ?? ""];
    case "faq":
      return block.items.flatMap((item) => [item.question, item.answer]);
    case "next":
      return block.items.flatMap((item) => [item.title, item.text]);
  }
}

export function helpSectionPlainText(section: HelpArticle["sections"][number]) {
  return section.blocks.flatMap(blockText).map(inlineToPlain).join(" ");
}

/** Temps de lecture arrondi à la minute, à 200 mots par minute. */
export function helpReadingMinutes(article: HelpArticle) {
  const text = [article.summary, ...article.sections.map(helpSectionPlainText)].join(" ");
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/** Index de recherche : un article, puis chacune de ses sections. Il est petit et part dans le bundle client. */
export function buildHelpSearchIndex(): HelpSearchEntry[] {
  return HELP_ARTICLES.flatMap((article) => {
    const group = getHelpGroup(article.groupId).label;
    const articleEntry: HelpSearchEntry = {
      href: helpArticleHref(article.slug),
      title: article.title,
      context: group,
      haystack: normalizeHelpSearch(`${article.title} ${article.summary} ${article.keywords.join(" ")}`),
      emphasis: normalizeHelpSearch(`${article.title} ${article.keywords.join(" ")}`),
    };
    const sections = article.sections.map((section) => ({
      href: helpArticleHref(article.slug, section.id),
      title: section.title,
      context: `${group} · ${article.title}`,
      haystack: normalizeHelpSearch(`${section.title} ${helpSectionPlainText(section)}`),
      emphasis: normalizeHelpSearch(section.title),
    }));
    return [articleEntry, ...sections];
  });
}

const SUGGESTED_HREFS = [
  "/aide/demarrer",
  "/aide/demarrer#etape-3",
  "/aide/demarrer#etape-5",
  "/aide/reprendre",
  "/aide/connaissances",
  "/aide/forfaits",
];

/** Résultats proposés avant toute saisie dans la recherche. */
export function getHelpSearchSuggestions(index: HelpSearchEntry[]) {
  return SUGGESTED_HREFS.flatMap((href) => index.filter((entry) => entry.href === href));
}

/** « 22 novembre 2026 », quel que soit le fuseau du serveur. */
export function formatHelpDate(isoDay: string) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${isoDay}T12:00:00Z`));
}
