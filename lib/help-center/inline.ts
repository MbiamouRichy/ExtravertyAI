import { SITE_URL } from "../site";

/**
 * Mise en forme légère des textes d’aide. Aucun HTML n’est accepté : le texte
 * est découpé en jetons que chaque sortie (React, Markdown, WhatsApp) rend
 * elle-même, sans jamais interpréter de balise.
 */
export type InlineToken =
  | { type: "text"; value: string }
  | { type: "strong"; value: string }
  | { type: "ui"; value: string }
  | { type: "link"; value: string; href: string; external: boolean };

const INLINE = /\*\*(.+?)\*\*|\[\[(.+?)\]\]|\[([^\]]+)\]\(([^)\s]+)\)/g;
const INTERNAL_HREF = /^\/aide(?:\/[a-z0-9-]+)?(?:#[a-z0-9-]+)?$/;
const EXTERNAL_HREF = /^https:\/\/[^\s"'<>]+$/;

export function isAllowedHelpHref(href: string) {
  return INTERNAL_HREF.test(href) || EXTERNAL_HREF.test(href);
}

export function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let cursor = 0;
  for (const match of text.matchAll(INLINE)) {
    const index = match.index ?? 0;
    if (index > cursor) tokens.push({ type: "text", value: text.slice(cursor, index) });
    const [whole, strong, ui, label, href] = match;
    if (strong !== undefined) tokens.push({ type: "strong", value: strong });
    else if (ui !== undefined) tokens.push({ type: "ui", value: ui });
    else if (isAllowedHelpHref(href)) {
      tokens.push({ type: "link", value: label, href, external: href.startsWith("https://") });
    } else {
      // Un lien non reconnu reste du texte : jamais de javascript: ni de protocole inattendu.
      tokens.push({ type: "text", value: whole });
    }
    cursor = index + whole.length;
  }
  if (cursor < text.length) tokens.push({ type: "text", value: text.slice(cursor) });
  return tokens;
}

function absolute(href: string) {
  return href.startsWith("/") ? `${SITE_URL}${href}` : href;
}

/** Markdown pour l’export et le futur assistant : liens absolus, libellés d’interface en gras. */
export function inlineToMarkdown(text: string) {
  return parseInline(text)
    .map((token) => {
      switch (token.type) {
        case "text":
          return token.value;
        case "strong":
          return `**${token.value}**`;
        case "ui":
          return `**${token.value}**`;
        case "link":
          return `[${token.value}](${absolute(token.href)})`;
      }
    })
    .join("");
}

/** Texte prêt à coller dans WhatsApp, qui met en gras avec un seul astérisque. */
export function inlineToWhatsApp(text: string) {
  return parseInline(text)
    .map((token) => {
      switch (token.type) {
        case "text":
          return token.value;
        case "strong":
        case "ui":
          return `*${token.value}*`;
        case "link": {
          const url = absolute(token.href);
          return url.replace(/^https:\/\/(www\.)?/, "") === token.value ? url : `${token.value} : ${url}`;
        }
      }
    })
    .join("");
}

/** Texte brut, pour la recherche et le calcul du temps de lecture. */
export function inlineToPlain(text: string) {
  return parseInline(text)
    .map((token) => token.value)
    .join("");
}
