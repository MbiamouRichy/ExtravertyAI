/**
 * Génère les visuels de marque en PNG, sans serveur Next :
 *   - public/og-image.png : image de partage des liens (1200 × 630),
 *     déclarée dans les métadonnées `openGraph` et `twitter` du site ;
 *   - docs/visuels/couverture-facebook.png : couverture de la page Facebook
 *     (1640 × 624), à téléverser à la main sur Facebook.
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

type Theme = "light" | "dark";
type VisualId = "og-image" | "facebook-cover";

const OUTPUTS: readonly { id: VisualId; file: string; width: number; height: number; theme: Theme }[] = [
  { id: "og-image", file: "public/og-image.png", width: 1200, height: 630, theme: "dark" },
  { id: "facebook-cover", file: "docs/visuels/couverture-facebook.png", width: 1640, height: 624, theme: "dark" },
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

const RENDER: Record<VisualId, (theme: Theme, logo: string) => string> = {
  "og-image": ogImage,
  "facebook-cover": facebookCover,
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
