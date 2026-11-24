/**
 * Génère les icônes du site depuis public/logo.png.
 *
 * Icônes principales : le logo en blanc dans une pastille noire pleine, coins
 * transparents. Google affiche les favicons dans un rond : une pastille pleine
 * le remplit entièrement, là où un logo détouré y paraît petit, posé sur le
 * fond gris que Google ajoute aux icônes transparentes. Le blanc sur noir reste
 * lisible sur fond clair comme sur fond sombre (onglets, favoris).
 *
 *   public/android-chrome-192x192.png  192 px    manifeste, <link rel="icon">, résultats Google
 *   public/android-chrome-512x512.png  512 px    manifeste, logo des données structurées
 *   app/favicon.ico                    16 à 256  onglets et favoris
 *
 * iOS remplit de noir la transparence et arrondit lui-même les coins : son
 * icône est donc un carré noir plein, sans pastille.
 *
 *   public/apple-touch-icon.png        180 px    iOS et vignettes de Chrome
 *
 * Icône « maskable » du manifeste : Android la découpe et exige un fond plein,
 * elle garde donc le logo blanc sur le noir du thème, dans la zone sûre.
 *
 *   public/maskable-icon-512x512.png   512 px
 *
 * Usage : npx tsx scripts/generate-icons.ts
 */
import { writeFile } from "node:fs/promises";

import sharp from "sharp";

const LOGO = "public/logo.png";
const FAVICON_SIZES = [16, 32, 48, 64, 128, 256];
// Noir du thème (#0a0a0a).
const BACKGROUND = { r: 10, g: 10, b: 10, alpha: 1 } as const;
// Hauteur du logo rapportée au côté de l’icône : antenne, oreilles et bulle
// restent dans la pastille, avec une marge noire autour.
const MARK_HEIGHT = 0.75;
// Icône dessinée en plus grand puis réduite, pour des bords lissés.
const SUPERSAMPLING = 4;
const PNG_OPTIONS = { palette: true, colors: 256, dither: 0, compressionLevel: 9, effort: 10 } as const;

// Logo blanc, centré sur une pastille ronde ou sur un carré noir plein.
async function markIcon(size: number, shape: "disc" | "square", markHeight = MARK_HEIGHT) {
  const canvas = size * SUPERSAMPLING;
  const mark = await sharp(LOGO)
    .negate({ alpha: false })
    .trim()
    .resize({ height: Math.round(canvas * markHeight), kernel: "lanczos3" })
    .toBuffer();
  const radius = canvas / 2;
  const background =
    shape === "disc"
      ? sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${canvas}" height="${canvas}"><circle cx="${radius}" cy="${radius}" r="${radius}" fill="rgb(${BACKGROUND.r},${BACKGROUND.g},${BACKGROUND.b})"/></svg>`))
      : sharp({ create: { width: canvas, height: canvas, channels: 4, background: BACKGROUND } });
  const drawn = await background.composite([{ input: mark, gravity: "centre" }]).png().toBuffer();
  return sharp(drawn).resize(size, size, { kernel: "lanczos3" }).png(PNG_OPTIONS).toBuffer();
}

// Fichier ICO contenant des images PNG, lu par tous les navigateurs actuels.
function ico(images: readonly { size: number; png: Buffer }[]) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const directory = Buffer.alloc(16 * images.length);
  let offset = header.length + directory.length;
  images.forEach(({ size, png }, index) => {
    const entry = 16 * index;
    directory.writeUInt8(size >= 256 ? 0 : size, entry);
    directory.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    directory.writeUInt16LE(1, entry + 4);
    directory.writeUInt16LE(32, entry + 6);
    directory.writeUInt32LE(png.length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  return Buffer.concat([header, directory, ...images.map(({ png }) => png)]);
}

async function save(file: string, data: Buffer, size: number | string) {
  if (typeof size === "number") {
    const meta = await sharp(data).metadata();
    if (meta.width !== size || meta.height !== size) throw new Error(`${file} mesure ${meta.width} × ${meta.height}.`);
  }
  await writeFile(file, data);
  console.log(`${file} : ${typeof size === "number" ? `${size} × ${size}` : size}, ${(data.length / 1024).toFixed(1)} Ko`);
}

async function main() {
  for (const size of [192, 512]) {
    await save(`public/android-chrome-${size}x${size}.png`, await markIcon(size, "disc"), size);
  }
  await save("public/apple-touch-icon.png", await markIcon(180, "square"), 180);
  // Le cercle de 80 % que garantit Android contient le logo à 54 % de hauteur.
  await save("public/maskable-icon-512x512.png", await markIcon(512, "square", 0.54), 512);

  const favicons = await Promise.all(FAVICON_SIZES.map(async (size) => ({ size, png: await markIcon(size, "disc") })));
  await save("app/favicon.ico", ico(favicons), `${FAVICON_SIZES.join(", ")} px`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
