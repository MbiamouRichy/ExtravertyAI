import { SITE_CONTACT, SITE_NAME, SITE_URL } from "../site";
import { formatHelpDate, getHelpGroup, getHelpNavigation, helpArticleHref, helpReadingMinutes } from "./articles";
import { HELP_ARTICLES, HELP_UPDATED_AT, type HelpArticle, type HelpBlock, type HelpSection } from "./content";
import { inlineToMarkdown, inlineToWhatsApp } from "./inline";

/**
 * Export Markdown du centre d’aide : /aide.md et docs/centre-aide.md.
 * Il sert de base de connaissances au futur assistant de l’application et
 * aux réponses du support sur WhatsApp. Les illustrations y sont décrites
 * en texte, puisqu’un modèle de langage ne les voit pas.
 */

const md = inlineToMarkdown;

function cell(value: string) {
  return md(value).replace(/\|/g, "\\|");
}

function blockToMarkdown(block: HelpBlock): string {
  switch (block.type) {
    case "p":
      return md(block.text);
    case "steps":
      return block.items.map((item, index) => `${index + 1}. ${md(item)}`).join("\n");
    case "bullets":
      return block.items.map((item) => `- ${md(item)}`).join("\n");
    case "checklist":
      return block.items.map((item) => `- [ ] ${md(item)}`).join("\n");
    case "callout":
      return `> **${block.title}** : ${md(block.text)}`;
    case "example":
      return `> **${block.title}**\n>\n> ${md(block.text)}`;
    case "figure":
      return `> *Illustration* : ${md(block.description)}`;
    case "table": {
      const lines = [
        `| ${block.head.map(cell).join(" | ")} |`,
        `| ${block.head.map(() => "---").join(" | ")} |`,
        ...block.rows.map((row) => `| ${row.map(cell).join(" | ")} |`),
      ];
      return block.note ? `${lines.join("\n")}\n\n${md(block.note)}` : lines.join("\n");
    }
    case "faq":
      return block.items.map((item) => `**${md(item.question)}**\n\n${md(item.answer)}`).join("\n\n");
    case "next":
      return block.items
        .map((item) => `- [${item.title}](${SITE_URL}${helpArticleHref(item.slug)}) : ${md(item.text)}`)
        .join("\n");
  }
}

function sectionToMarkdown(section: HelpSection, depth: number) {
  const level = "#".repeat(depth + (section.level === 3 ? 1 : 0));
  const title = section.step
    ? `${level} Étape ${section.step.number} : ${section.title} (${section.step.duration})`
    : `${level} ${section.title}`;
  const parts = [title, ...section.blocks.map(blockToMarkdown)];
  if (section.step) {
    parts.push(
      "*Version courte, à envoyer sur WhatsApp :*",
      section.step.whatsapp.map((line) => `- ${md(line)}`).join("\n"),
    );
  }
  return parts.join("\n\n");
}

export function helpArticleToMarkdown(article: HelpArticle, depth = 1) {
  const heading = "#".repeat(depth);
  const meta = [
    `Rubrique : ${getHelpGroup(article.groupId).label}`,
    article.plan ? `Offre : ${article.plan}` : null,
    article.audience ?? null,
    `Lecture : ${helpReadingMinutes(article)} min`,
    `Page : ${SITE_URL}${helpArticleHref(article.slug)}`,
  ].filter(Boolean);
  return [
    `${heading} ${article.title}`,
    `*${meta.join(" · ")}*`,
    md(article.summary),
    ...article.sections.map((section) => sectionToMarkdown(section, depth + 1)),
  ].join("\n\n");
}

export function helpCenterToMarkdown() {
  const contents = getHelpNavigation()
    .map(
      (group) =>
        `- **${group.label}** : ${group.articles
          .map((article) => article.title)
          .join(", ")}`,
    )
    .join("\n");
  const articles = getHelpNavigation().flatMap((group) => [
    `## ${group.label}\n\n${group.description}`,
    ...group.articles.map((entry) => {
      const article = HELP_ARTICLES.find((candidate) => candidate.slug === entry.slug)!;
      return helpArticleToMarkdown(article, 3);
    }),
  ]);
  return `# Centre d’aide ${SITE_NAME}

> Guide d’utilisation d’${SITE_NAME}, l’assistant IA qui répond aux clients sur WhatsApp. Mis à jour le ${formatHelpDate(HELP_UPDATED_AT)}. Version en ligne : ${SITE_URL}/aide

Ce document est généré à partir de lib/help-center/content.ts (npm run help:export) : ne le modifiez pas à la main. Les mots en gras désignent souvent un bouton ou un écran de l’application, avec le libellé exact affiché.

Contact de l’équipe sur WhatsApp : ${SITE_CONTACT.whatsapp}

## Sommaire

${contents}

${articles.join("\n\n")}
`;
}

/** Texte d’une étape du guide, prêt à coller dans une conversation WhatsApp. */
export function helpStepToWhatsApp(section: HelpSection) {
  if (!section.step) return "";
  return [
    `*Étape ${section.step.number} : ${inlineToWhatsApp(section.title)}*`,
    ...section.step.whatsapp.map((line, index) => `${index + 1}. ${inlineToWhatsApp(line)}`),
  ].join("\n");
}
