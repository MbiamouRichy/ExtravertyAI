/**
 * Génère les visuels de marque en PNG, sans serveur Next :
 *   - public/og-image.png : image de partage des liens (1200 × 630),
 *     déclarée dans les métadonnées `openGraph` et `twitter` du site ;
 *   - docs/visuels/couverture-facebook.png : couverture de la page Facebook
 *     (1640 × 624), à téléverser à la main sur Facebook ;
 *   - docs/visuels/pub-carre.png et pub-story.png : visuels publicitaires
 *     Facebook et Instagram (1080 × 1080 et 1080 × 1920).
 *
 * Les couleurs sont lues dans app/globals.css (thème shadcn/ui), les logos
 * dans public/, et les polices du site (Bricolage Grotesque, Crimson Text
 * italique, Roboto Mono) dans .next/ : next/font les y dépose au premier
 * `next dev` ou `next build`. Aucun accès réseau n’est nécessaire, seulement
 * Chrome (autre navigateur : E2E_BROWSER_CHANNEL=msedge, par exemple).
 *
 * Usage :
 *   npx tsx scripts/generate-social-images.ts                  écrit les fichiers ci-dessus
 *   npx tsx scripts/generate-social-images.ts --preview <dir>   écrit les deux thèmes dans <dir>
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright";
import sharp from "sharp";

import {
  PRICING_PLANS,
  TRIAL_DAYS,
  TRIAL_MESSAGES,
  formatMessageLimit,
  formatPlanPrice,
  type PlanId,
} from "../lib/pricing";

type Theme = "light" | "dark";
type VisualId = string;

// Calendrier des publications : une par jour, contenu dans POSTS plus bas.
const POST_DATES = [
  "2026-11-19",
  "2026-11-20",
  "2026-11-21",
  "2026-11-22",
  "2026-11-23",
  "2026-11-24",
  "2026-11-25",
  "2026-11-26",
] as const;
type PostDate = (typeof POST_DATES)[number];

const OUTPUTS: readonly { id: VisualId; file: string; width: number; height: number; theme: Theme }[] = [
  { id: "og-image", file: "public/og-image.png", width: 1200, height: 630, theme: "dark" },
  { id: "facebook-cover", file: "docs/visuels/couverture-facebook.png", width: 1640, height: 624, theme: "dark" },
  { id: "ad-square", file: "docs/visuels/pub-carre.png", width: 1080, height: 1080, theme: "dark" },
  { id: "ad-story", file: "docs/visuels/pub-story.png", width: 1080, height: 1920, theme: "dark" },
  // Publications Facebook et Instagram (4:5), une par jour : voir POSTS.
  ...POST_DATES.map((date) => ({
    id: `post-${date}`,
    file: `docs/visuels/publications/${date}.png`,
    width: 1080,
    height: 1350,
    theme: "dark" as Theme,
  })),
];

// Origine fictive : toutes ses requêtes sont servies depuis le disque.
const ORIGIN = "http://visuels.localhost";
const FONT_FAMILIES = ["Bricolage Grotesque", "Crimson Text", "Roboto Mono"];
const REQUIRED_FONTS = ['800 90px "Bricolage Grotesque"', 'italic 400 90px "Crimson Text"', '500 20px "Roboto Mono"'];

// Reprend les @font-face générés par next/font (build de production d’abord,
// sinon serveur de développement) et pointe leurs fichiers vers /fonts/.
async function siteFontFaces() {
  for (const root of [".next", path.join(".next", "dev")]) {
    const faces = new Set<string>();
    const files = new Map<string, string>();
    for (const dir of [path.join(root, "static", "css"), path.join(root, "static", "chunks")]) {
      const sheets = await readdir(dir).catch(() => [] as string[]);
      for (const sheet of sheets.filter((name) => name.endsWith(".css"))) {
        const css = await readFile(path.join(dir, sheet), "utf8");
        for (const face of css.match(/@font-face\s*\{[^}]*\}/g) ?? []) {
          const family = face.match(/font-family:\s*["']?([^;"']+)/)?.[1].trim();
          if (!family || !FONT_FAMILIES.includes(family)) continue;
          faces.add(
            face.replace(/url\(\s*["']?([^)"']+)["']?\s*\)/g, (_, url: string) => {
              const file = url.startsWith("/_next/")
                ? path.join(root, url.slice("/_next/".length))
                : path.resolve(dir, url);
              files.set(path.basename(file), file);
              return `url(/fonts/${path.basename(file)})`;
            }),
          );
        }
      }
    }
    if (faces.size) return { css: [...faces].join("\n"), files };
  }
  throw new Error("Polices du site introuvables dans .next/ : lancer `npm run dev` une fois, puis relancer ce script.");
}

// Jetons du thème shadcn/ui repris tels quels, en clair (:root) et en sombre (.dark).
const TOKENS = ["background", "foreground", "muted", "muted-foreground", "border", "primary", "primary-foreground"];

async function themeTokens() {
  const css = await readFile("app/globals.css", "utf8");
  const declarations = (selector: string) => {
    const start = css.search(new RegExp(`^${selector.replace(".", "\\.")} \\{`, "m"));
    if (start < 0) throw new Error(`Bloc ${selector} introuvable dans app/globals.css.`);
    const body = css.slice(start, css.indexOf("}", start));
    return TOKENS.map((name) => {
      const value = body.match(new RegExp(`\\s--${name}:\\s*([^;]+);`))?.[1].trim();
      if (!value?.startsWith("oklch(")) throw new Error(`--${name} illisible dans ${selector}.`);
      return `--${name}: ${value};`;
    }).join(" ");
  };
  return `:root { ${declarations(":root")} } .dark { ${declarations(".dark")} }`;
}

async function dataUri(file: string) {
  return `data:image/png;base64,${(await readFile(file)).toString("base64")}`;
}

// Icônes Lucide (Sparkles, CheckCheck), comme dans le simulateur de la page d’accueil.
const icon = (body: string, size: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const SPARKLES =
  '<path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/><path d="M20 2v4"/><path d="M22 4h-4"/><circle cx="4" cy="20" r="2"/>';
const CHECK_CHECK = '<path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/>';
const CHECK = '<path d="M20 6 9 17l-5-5"/>';

// Arguments de la page d’accueil, sans chiffre susceptible de changer.
const PROMISES = ["Réponse en quelques secondes", "Jour et nuit", "Sans changer de numéro"];

const STYLES = /* css */ `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { display: flex; flex-direction: column; align-items: flex-start; gap: 40px; padding: 40px; background: #777; }
  .visual {
    position: relative; isolation: isolate; overflow: hidden; flex-shrink: 0;
    display: flex; flex-direction: column;
    background: var(--background); color: var(--foreground);
    font-family: "Roboto Mono", monospace; -webkit-font-smoothing: antialiased;
  }
  .grid {
    position: absolute; inset: 0; z-index: -1;
    background-image:
      linear-gradient(to right, var(--border) 1px, transparent 1px),
      linear-gradient(to bottom, var(--border) 1px, transparent 1px);
    background-size: 72px 72px;
  }
  .heading { font-family: "Bricolage Grotesque", sans-serif; font-weight: 800; line-height: 1.02; letter-spacing: -0.055em; }
  .serif { font-family: "Crimson Text", serif; font-style: italic; font-weight: 400; letter-spacing: normal; padding-right: 0.08em; }
  .brand { font-family: "Bricolage Grotesque", sans-serif; font-weight: 700; letter-spacing: -0.025em; }
  .eyebrow { font-weight: 500; text-transform: uppercase; letter-spacing: 0.2em; color: var(--muted-foreground); }
  .muted { color: var(--muted-foreground); }
  .strong { color: var(--foreground); }
  .pill { border: 1px solid var(--border); border-radius: 9999px; background: var(--background); }
  .row { display: flex; align-items: center; }
  .bubble {
    padding: 18px 22px; border-radius: 22px;
    font-size: 19px; line-height: 1.4; text-align: left;
    box-shadow: 0 20px 25px -5px color-mix(in oklch, var(--foreground) 6%, transparent),
      0 8px 10px -6px color-mix(in oklch, var(--foreground) 6%, transparent);
  }
  .bubble.client { border: 1px solid var(--border); border-bottom-left-radius: 8px; background: var(--muted); }
  .bubble.ai { border-bottom-right-radius: 8px; background: var(--primary); color: var(--primary-foreground); }
  .meta { display: flex; align-items: center; gap: 6px; font-size: 14px; }
  .bubble.ai .meta { opacity: 0.7; }
  .bubble.client .meta { color: var(--muted-foreground); }
`;

const HEADLINE = `Chaque message mérite<br>une réponse <em class="serif">immédiate.</em>`;

function ogImage(theme: Theme, logo: string) {
  return `
  <section class="visual ${theme}" data-visual="og-image" data-theme="${theme}"
    style="width: 1200px; height: 630px; padding: 72px 80px 76px;">
    <div class="grid" style="mask-image: radial-gradient(ellipse 75% 85% at 88% 0%, black, transparent);"></div>
    <div class="row" style="justify-content: space-between;">
      <span class="row" style="gap: 14px;">
        <img src="${logo}" alt="" style="height: 56px;">
        <span class="brand" style="font-size: 36px;">ExtravertyAI</span>
      </span>
      <span class="pill muted" style="padding: 8px 20px; font-size: 19px;">extravertyai.com</span>
    </div>
    <div style="margin-top: auto;">
      <p class="eyebrow" style="font-size: 19px;">Assistant IA pour WhatsApp</p>
      <p class="heading" style="margin-top: 20px; font-size: 90px;">${HEADLINE}</p>
      <ul class="row muted" style="margin-top: 36px; gap: 36px; font-size: 22px; list-style: none;">
        ${PROMISES.map((item) => `<li class="row" style="gap: 10px;"><span class="row strong">${icon(CHECK, 22)}</span>${item}</li>`).join("")}
      </ul>
    </div>
  </section>`;
}

// Facebook affiche la couverture en 820 × 312 sur ordinateur et n’en garde
// que les 1 110 px centraux sur mobile : tout le contenu tient entre x = 310
// et x = 1330, et le bas gauche, où passe la photo de profil, reste vide.
function facebookCover(theme: Theme, logo: string) {
  return `
  <section class="visual ${theme}" data-visual="facebook-cover" data-theme="${theme}"
    style="width: 1640px; height: 624px; flex-direction: row; align-items: center; justify-content: space-between; padding: 0 310px;">
    <div class="grid" style="mask-image: radial-gradient(ellipse 58% 95% at 50% 45%, black, transparent);"></div>

    <div>
      <span class="row" style="gap: 12px;">
        <img src="${logo}" alt="" style="height: 44px;">
        <span class="brand" style="font-size: 28px;">ExtravertyAI</span>
      </span>
      <p class="eyebrow" style="margin-top: 40px; font-size: 17px;">Assistant IA pour WhatsApp</p>
      <p class="heading" style="margin-top: 16px; font-size: 66px;">
        Chaque message<br>mérite une réponse<br><em class="serif">immédiate.</em>
      </p>
      <p class="muted" style="margin-top: 24px; font-size: 20px;">Jour et nuit, sans changer de numéro.</p>
    </div>

    <div style="display: flex; width: 390px; flex-direction: column; gap: 14px;">
      <div class="bubble client" style="align-self: flex-start; max-width: 340px; border-bottom-left-radius: 8px;">
        Bonsoir ! Vous avez encore les sneakers blanches en 42 ?
        <span class="meta" style="justify-content: flex-end; margin-top: 6px;">21:47</span>
      </div>
      <div class="bubble ai" style="align-self: flex-end; max-width: 360px;">
        <span class="meta eyebrow" style="margin-bottom: 6px; color: inherit; letter-spacing: 0.08em;">${icon(SPARKLES, 15)} IA · répondu en 3 s</span>
        Oui, il nous reste 3 paires en 42. Je vous en mets une de côté ?
        <span class="meta" style="justify-content: flex-end; margin-top: 6px;">21:47 ${icon(CHECK_CHECK, 15)}</span>
      </div>
    </div>
  </section>`;
}

// Conversation de démonstration des publicités : un client écrit tard le
// soir, l’assistant répond aussitôt. Aucun chiffre commercial réel.
function adConversation(scale: number) {
  const px = (value: number) => `${Math.round(value * scale)}px`;
  return `
    <div style="display: flex; flex-direction: column; gap: ${px(16)};">
      <div class="bubble client" style="align-self: flex-start; max-width: 78%; font-size: ${px(26)}; padding: ${px(22)} ${px(28)}; border-radius: ${px(28)}; border-bottom-left-radius: ${px(10)};">
        Bonsoir&nbsp;! Vous livrez à Libreville ce week&#8209;end&nbsp;?
        <span class="meta" style="justify-content: flex-end; margin-top: ${px(8)}; font-size: ${px(18)};">23:12</span>
      </div>
      <div class="bubble ai" style="align-self: flex-end; max-width: 82%; font-size: ${px(26)}; padding: ${px(22)} ${px(28)}; border-radius: ${px(28)}; border-bottom-right-radius: ${px(10)};">
        <span class="meta eyebrow" style="margin-bottom: ${px(8)}; color: inherit; letter-spacing: 0.08em; font-size: ${px(18)};">${icon(SPARKLES, Math.round(20 * scale))} IA · répondu aussitôt</span>
        Oui, nous livrons samedi et dimanche. Je note votre adresse pour la commande&nbsp;?
        <span class="meta" style="justify-content: flex-end; margin-top: ${px(8)}; font-size: ${px(18)};">23:12 ${icon(CHECK_CHECK, Math.round(20 * scale))}</span>
      </div>
    </div>`;
}

const AD_HEADLINE = `Vos clients écrivent à 23&nbsp;h.<br>Votre IA leur répond <em class="serif">tout&nbsp;de&nbsp;suite.</em>`;
const AD_HEADLINE_STORY = `Vos clients écrivent<br>à 23&nbsp;h. Votre IA<br>leur répond<br><em class="serif">tout&nbsp;de&nbsp;suite.</em>`;

// Publicité carrée (fil Facebook et Instagram, 1080 × 1080).
function adSquare(theme: Theme, logo: string) {
  return `
  <section class="visual ${theme}" data-visual="ad-square" data-theme="${theme}"
    style="width: 1080px; height: 1080px; padding: 72px 72px 76px;">
    <div class="grid" style="mask-image: radial-gradient(ellipse 80% 70% at 85% 0%, black, transparent);"></div>
    <div class="row" style="justify-content: space-between;">
      <span class="row" style="gap: 14px;">
        <img src="${logo}" alt="" style="height: 56px;">
        <span class="brand" style="font-size: 36px;">ExtravertyAI</span>
      </span>
      <span class="pill muted" style="padding: 8px 20px; font-size: 20px;">extravertyai.com</span>
    </div>
    <p class="eyebrow" style="margin-top: 64px; font-size: 20px;">Assistant IA pour WhatsApp</p>
    <p class="heading" style="margin-top: 20px; font-size: 68px;">${AD_HEADLINE}</p>
    <div style="margin-top: auto;">${adConversation(1)}</div>
    <ul class="row muted" style="margin-top: 44px; gap: 28px; font-size: 20px; white-space: nowrap; list-style: none;">
      ${PROMISES.map((item) => `<li class="row" style="gap: 10px;"><span class="row strong">${icon(CHECK, 22)}</span>${item}</li>`).join("")}
    </ul>
  </section>`;
}

// Publicité verticale (Stories et Reels, 1080 × 1920). Instagram recouvre
// environ 250 px en haut (profil) et 340 px en bas (bouton d’action) : le
// contenu reste entre ces deux bandes.
function adStory(theme: Theme, logo: string) {
  return `
  <section class="visual ${theme}" data-visual="ad-story" data-theme="${theme}"
    style="width: 1080px; height: 1920px; padding: 270px 80px 360px;">
    <div class="grid" style="mask-image: radial-gradient(ellipse 90% 60% at 50% 35%, black, transparent);"></div>
    <span class="row" style="gap: 16px;">
      <img src="${logo}" alt="" style="height: 64px;">
      <span class="brand" style="font-size: 42px;">ExtravertyAI</span>
    </span>
    <p class="eyebrow" style="margin-top: 72px; font-size: 24px;">Assistant IA pour WhatsApp</p>
    <p class="heading" style="margin-top: 24px; font-size: 92px;">${AD_HEADLINE_STORY}</p>
    <div style="margin-top: auto;">${adConversation(1.2)}</div>
    <ul class="muted" style="margin-top: 56px; display: flex; flex-direction: column; gap: 18px; font-size: 28px; list-style: none;">
      ${PROMISES.map((item) => `<li class="row" style="gap: 14px;"><span class="row strong">${icon(CHECK, 28)}</span>${item}</li>`).join("")}
    </ul>
  </section>`;
}

// ── Publications quotidiennes (1080 × 1350) ─────────────────────────────────
// Chaque argument vient du site (accueil, FAQ, lib/pricing.ts) : aucune
// promesse ni chiffre qui n’y figure pas. Les conversations sont des exemples.

const bubble = (side: "client" | "ai", text: string, time: string, label?: string) =>
  side === "client"
    ? `<div class="bubble client" style="align-self: flex-start; max-width: 80%; font-size: 26px; padding: 22px 28px; border-radius: 28px; border-bottom-left-radius: 10px;">
        ${text}
        <span class="meta" style="justify-content: flex-end; margin-top: 8px; font-size: 18px;">${time}</span>
      </div>`
    : `<div class="bubble ai" style="align-self: flex-end; max-width: 84%; font-size: 26px; padding: 22px 28px; border-radius: 28px; border-bottom-right-radius: 10px;">
        <span class="meta eyebrow" style="margin-bottom: 8px; color: inherit; letter-spacing: 0.08em; font-size: 18px;">${icon(SPARKLES, 20)} ${label ?? "IA · répondu aussitôt"}</span>
        ${text}
        <span class="meta" style="justify-content: flex-end; margin-top: 8px; font-size: 18px;">${time} ${icon(CHECK_CHECK, 20)}</span>
      </div>`;

const conversation = (...bubbles: string[]) =>
  `<div style="display: flex; flex-direction: column; gap: 16px;">${bubbles.join("")}</div>`;

const checklist = (items: readonly string[]) => `
  <ul style="display: flex; flex-direction: column; gap: 22px; list-style: none; font-size: 34px; line-height: 1.35;">
    ${items.map((item) => `<li class="row" style="gap: 18px; align-items: flex-start;"><span class="row strong" style="margin-top: 4px;">${icon(CHECK, 32)}</span><span>${item}</span></li>`).join("")}
  </ul>`;

const steps = (items: readonly [string, string][]) => `
  <ol style="display: flex; flex-direction: column; gap: 18px; list-style: none;">
    ${items
      .map(
        ([title, text], index) => `
      <li class="pill" style="display: flex; gap: 28px; align-items: center; border-radius: 24px; padding: 26px 30px;">
        <span class="heading" style="font-size: 54px; min-width: 70px;">0${index + 1}</span>
        <span><span class="brand" style="display: block; font-size: 30px;">${title}</span>
        <span class="muted" style="display: block; margin-top: 6px; font-size: 22px; line-height: 1.4;">${text}</span></span>
      </li>`,
      )
      .join("")}
  </ol>`;

const quote = (text: string) =>
  `<p class="pill" style="border-radius: 28px; padding: 40px 44px; font-size: 34px; line-height: 1.45;">${text}</p>`;

const voiceNote = (duration: string, time: string) => `
  <div class="bubble client" style="align-self: flex-start; width: 62%; font-size: 22px; padding: 22px 28px; border-radius: 28px; border-bottom-left-radius: 10px;">
    <span class="row" style="gap: 16px;">
      <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
      <span class="row" style="gap: 5px; height: 40px; flex: 1;">
        ${[10, 22, 34, 18, 28, 40, 24, 14, 30, 36, 20, 12, 26, 32, 16, 22, 10, 18]
          .map((h) => `<span style="width: 6px; height: ${h}px; border-radius: 9999px; background: currentColor; opacity: 0.7;"></span>`)
          .join("")}
      </span>
      <span class="muted">${duration}</span>
    </span>
    <span class="meta" style="justify-content: flex-end; margin-top: 8px; font-size: 18px;">${time}</span>
  </div>`;

const toggleCard = () => `
  <div class="pill" style="border-radius: 28px; padding: 30px 34px;">
    <div class="row" style="justify-content: space-between;">
      <span>
        <span class="brand" style="display: block; font-size: 30px;">Conversation · Client Libreville</span>
        <span class="muted" style="display: block; margin-top: 6px; font-size: 22px;">Réponses automatiques</span>
      </span>
      <span class="row" style="width: 96px; height: 52px; border-radius: 9999px; background: var(--muted); border: 1px solid var(--border); padding: 5px;">
        <span style="width: 40px; height: 40px; border-radius: 9999px; background: var(--muted-foreground);"></span>
      </span>
    </div>
    <p class="muted" style="margin-top: 22px; font-size: 22px; line-height: 1.45;">IA désactivée : vous répondez vous-même, l’assistant reprend quand vous le rallumez.</p>
  </div>`;

/** Ce qui distingue chaque offre sur le visuel des tarifs. */
const POST_PLAN_HIGHLIGHT: Record<PlanId, string> = {
  starter: "réponses texte",
  pro: "notes vocales",
  business: "notes vocales et images",
};

const priceRows = (rows: readonly (readonly [string, string, string])[]) => `
  <div style="display: flex; flex-direction: column; gap: 14px;">
    ${rows
      .map(
        ([name, price, detail], index) => `
      <div class="${index === 1 ? "bubble ai" : "pill"}" style="display: flex; justify-content: space-between; align-items: center; border-radius: 24px; padding: 26px 32px; ${index === 1 ? "box-shadow: none;" : ""}">
        <span><span class="brand" style="display: block; font-size: 32px;">${name}</span>
        <span style="display: block; margin-top: 6px; font-size: 20px; opacity: 0.75;">${detail}</span></span>
        <span class="heading" style="font-size: 44px; white-space: nowrap;">${price}<span style="font-family: 'Roboto Mono', monospace; font-weight: 400; font-size: 20px; letter-spacing: normal;"> /mois</span></span>
      </div>`,
      )
      .join("")}
  </div>`;

const POSTS: Record<PostDate, { eyebrow: string; heading: string; body: string; note?: string }> = {
  "2026-11-19": {
    eyebrow: "Nouveau · Assistant IA pour WhatsApp",
    heading: `Chaque message mérite une réponse <em class="serif">immédiate.</em>`,
    body: checklist([
      "Réponse en quelques secondes, avec vos prix et votre ton",
      "Jour et nuit, même le week&#8209;end",
      "Sans changer de numéro WhatsApp",
    ]),
  },
  "2026-11-20": {
    eyebrow: "Comment ça marche",
    heading: `Opérationnel avant votre <em class="serif">prochain café.</em>`,
    body: steps([
      ["Scannez un QR code", "Votre numéro reste le vôtre, vos clients ne voient aucune différence."],
      ["Décrivez votre activité", "Vos prix, vos règles et votre ton : l’assistant les apprend en quelques minutes."],
      ["L’assistant répond", "Il qualifie, et vous alerte quand un humain doit intervenir."],
    ]),
  },
  "2026-11-21": {
    eyebrow: "Samedi soir",
    heading: `Votre boutique ferme. <em class="serif">Pas votre WhatsApp.</em>`,
    body: conversation(
      bubble("client", "Bonsoir&nbsp;! La robe noire est encore disponible en taille&nbsp;M&nbsp;?", "21:04"),
      bubble("ai", "Oui, il en reste une en M. Je vous la mets de côté jusqu’à lundi&nbsp;?", "21:04"),
    ),
  },
  "2026-11-22": {
    eyebrow: "Question fréquente",
    heading: `Mes clients sauront-ils qu’ils parlent <em class="serif">à une IA&nbsp;?</em>`,
    body: quote(
      "Vous choisissez le ton et la signature de l’assistant. Nous recommandons la transparence&nbsp;: il peut se présenter et proposer un conseiller humain à tout moment.",
    ),
  },
  "2026-11-23": {
    eyebrow: "Reprise en main",
    heading: `L’IA travaille. <em class="serif">Vous décidez.</em>`,
    body: toggleCard(),
    note: "Un interrupteur par conversation, ou une pause générale depuis les réglages.",
  },
  "2026-11-24": {
    eyebrow: "Notes vocales",
    heading: `Vos clients préfèrent <em class="serif">parler&nbsp;?</em>`,
    body: conversation(
      voiceNote("0:18", "12:41"),
      bubble("ai", "Bien reçu&nbsp;: deux pagnes wax, livraison à Owendo demain. Je vous confirme le total&nbsp;?", "12:41", "IA · note vocale comprise"),
    ),
    note: "Compréhension des notes vocales incluse dans les offres Pro et Business.",
  },
  "2026-11-25": {
    eyebrow: "Sécurité",
    heading: `Vos données restent <em class="serif">les vôtres.</em>`,
    body: checklist([
      "Chaque espace est cloisonné, aucune donnée partagée entre clients",
      "Des permissions fines pour chaque membre de l’équipe",
      "Contacts et conversations exportables en CSV",
      "Supprimez un projet ou votre compte à tout moment",
    ]),
  },
  "2026-11-26": {
    eyebrow: "Offres",
    // Prix, quotas et essai lus dans lib/pricing.ts : le visuel suit la grille en vigueur.
    heading: `Essayez ${TRIAL_DAYS} jours, <em class="serif">gratuitement.</em>`,
    body: priceRows(
      PRICING_PLANS.map((plan) => [
        plan.name,
        formatPlanPrice(plan.priceCents),
        `${formatMessageLimit(plan.messageLimit)} messages · ${POST_PLAN_HIGHLIGHT[plan.id]}`,
      ]),
    ),
    note: `${TRIAL_MESSAGES} messages inclus pendant l’essai.`,
  },
};

function post(date: PostDate) {
  return (theme: Theme, logo: string) => {
    const { eyebrow, heading, body, note } = POSTS[date];
    return `
  <section class="visual ${theme}" data-visual="post-${date}" data-theme="${theme}"
    style="width: 1080px; height: 1350px; padding: 72px 72px 64px;">
    <div class="grid" style="mask-image: radial-gradient(ellipse 85% 60% at 85% 0%, black, transparent);"></div>
    <div class="row" style="justify-content: space-between;">
      <span class="row" style="gap: 14px;">
        <img src="${logo}" alt="" style="height: 56px;">
        <span class="brand" style="font-size: 36px;">ExtravertyAI</span>
      </span>
      <span class="pill muted" style="padding: 8px 20px; font-size: 20px;">extravertyai.com</span>
    </div>
    <p class="eyebrow" style="margin-top: 80px; font-size: 22px;">${eyebrow}</p>
    <p class="heading" style="margin-top: 26px; font-size: 104px; text-wrap: balance;">${heading}</p>
    <div style="margin-top: auto;">${body}</div>
    ${note ? `<p class="muted" style="margin-top: 32px; font-size: 21px;">${note}</p>` : ""}
  </section>`;
  };
}

const RENDER: Record<VisualId, (theme: Theme, logo: string) => string> = {
  "og-image": ogImage,
  "facebook-cover": facebookCover,
  "ad-square": adSquare,
  "ad-story": adStory,
  ...Object.fromEntries(POST_DATES.map((date) => [`post-${date}`, post(date)])),
};

async function main() {
  const previewFlag = process.argv.indexOf("--preview");
  const previewDir = previewFlag >= 0 ? process.argv[previewFlag + 1] : undefined;
  if (previewFlag >= 0 && !previewDir) throw new Error("Préciser le dossier après --preview.");

  const logos: Record<Theme, string> = {
    light: await dataUri("public/logo.png"),
    dark: await dataUri("public/logo-blanc.png"),
  };
  const themes: readonly Theme[] = ["dark", "light"];
  const body = OUTPUTS.flatMap(({ id }) => themes.map((theme) => RENDER[id](theme, logos[theme]))).join("");
  const fonts = await siteFontFaces();
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
    <style>${fonts.css}${await themeTokens()}${STYLES}</style></head><body>${body}</body></html>`;

  const browser = await chromium.launch({ channel: process.env.E2E_BROWSER_CHANNEL || "chrome" });
  try {
    const page = await browser.newPage({ viewport: { width: 1800, height: 1000 }, deviceScaleFactor: 1 });
    // Rien ne sort sur le réseau : la page et ses polices viennent du disque.
    await page.route("**/*", async (route) => {
      const { origin, pathname } = new URL(route.request().url());
      const font = pathname.startsWith("/fonts/") ? fonts.files.get(pathname.slice("/fonts/".length)) : undefined;
      if (origin === ORIGIN && pathname === "/") {
        await route.fulfill({ contentType: "text/html; charset=utf-8", body: html });
      } else if (origin === ORIGIN && font) {
        await route.fulfill({ contentType: "font/woff2", body: await readFile(font) });
      } else {
        await route.abort();
      }
    });
    await page.goto(`${ORIGIN}/`, { waitUntil: "networkidle" });
    const missing = await page.evaluate(async (fonts) => {
      await document.fonts.ready;
      const loaded = await Promise.all(fonts.map((font) => document.fonts.load(font, "Aé")));
      return fonts.filter((_, index) => loaded[index].length === 0);
    }, REQUIRED_FONTS);
    if (missing.length) throw new Error(`Polices non chargées (accès à Google Fonts ?) : ${missing.join(", ")}.`);

    for (const output of OUTPUTS) {
      for (const theme of previewDir ? themes : [output.theme]) {
        const node = page.locator(`[data-visual="${output.id}"][data-theme="${theme}"]`);
        const box = await node.boundingBox();
        if (!box || box.width !== output.width || box.height !== output.height) {
          throw new Error(`${output.id} mesure ${box?.width} × ${box?.height} au lieu de ${output.width} × ${output.height}.`);
        }

        const capture = await node.screenshot({ animations: "disabled", scale: "css" });
        // Palette de 256 couleurs : le thème est en niveaux de gris, la
        // quantification ne perd rien de visible et divise le poids.
        const png = await sharp(capture)
          .png({ palette: true, colors: 256, dither: 0, compressionLevel: 9, effort: 10 })
          .toBuffer();
        const meta = await sharp(png).metadata();
        if (meta.width !== output.width || meta.height !== output.height) {
          throw new Error(`${output.id} exporté en ${meta.width} × ${meta.height}.`);
        }

        const file = path.resolve(previewDir ? path.join(previewDir, `${output.id}-${theme}.png`) : output.file);
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, png);
        console.log(`${path.relative(process.cwd(), file)} : ${meta.width} × ${meta.height}, ${Math.round(png.length / 1024)} Ko`);
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
