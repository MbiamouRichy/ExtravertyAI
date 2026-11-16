/**
 * Génère les icônes du site depuis public/logo.png : logo blanc sur le noir
 * du thème (--foreground clair, oklch(0.145 0 0) = #0a0a0a), fond opaque et
 * logo de grande taille, pour rester lisible en thème clair comme en sombre
 * (vignettes de Chrome, écran d’accueil, résultats des moteurs de recherche).
 *
 *   public/apple-touch-icon.png        180 px    iOS et vignettes de Chrome
 *   public/android-chrome-192x192.png  192 px    manifeste, <link rel="icon">, résultats Google
 *   public/android-chrome-512x512.png  512 px    manifeste, logo des données structurées
 *   public/maskable-icon-512x512.png   512 px    manifeste (purpose « maskable »)
 *   app/favicon.ico                    16 à 256  onglets et favoris
 *
 * Usage : npx tsx scripts/generate-icons.ts
 */
import { writeFile } from "node:fs/promises";

import sharp from "sharp";

const BACKGROUND = { r: 10, g: 10, b: 10, alpha: 1 };
const FAVICON_SIZES = [16, 32, 48, 64, 128, 256];

type IconOptions = {
  size: number;
  // Hauteur du logo rapportée au côté de l’icône.
  logo: number;
  // Rayon des coins rapporté au côté ; 0 pour un carré plein, que la
  // plateforme découpe elle-même (iOS, Android).
  radius?: number;
};

// Le logo source est noir sur transparent, la lettre « e » étant évidée :
// l’inverser donne le logo blanc dont la lettre laisse voir le fond.
const whiteLogo = sharp("public/logo.png").negate({ alpha: false }).trim().png().toBuffer();

async function icon({ size, logo, radius = 0 }: IconOptions) {
  const mark = await sharp(await whiteLogo)
    .resize({ height: Math.round(size * logo), kernel: "lanczos3" })
    .toBuffer();
  const r = Math.round(size * radius);
  const corners = r
    ? [
        {
          input: Buffer.from(
            `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" ry="${r}"/></svg>`,
          ),
          blend: "dest-in" as const,
        },
      ]
    : [];
  const png = await sharp({ create: { width: size, height: size, channels: 4, background: BACKGROUND } })
    .composite([{ input: mark, gravity: "centre" }, ...corners])
    .png({ palette: true, colors: 256, dither: 0, compressionLevel: 9, effort: 10 })
    .toBuffer();
  const meta = await sharp(png).metadata();
  if (meta.width !== size || meta.height !== size) throw new Error(`Icône de ${size} px mal formée.`);
  return png;
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

async function save(file: string, data: Buffer, detail: string) {
  await writeFile(file, data);
  console.log(`${file} : ${detail}, ${(data.length / 1024).toFixed(1)} Ko`);
}

async function main() {
  // Carrés pleins : le logo occupe 80 % de la hauteur. Sa silhouette (antenne
  // centrée, coins du corps arrondis) reste dans le cercle que Chrome ou
  // Google peuvent appliquer.
  await save("public/apple-touch-icon.png", await icon({ size: 180, logo: 0.8 }), "180 × 180");
  for (const size of [192, 512]) {
    await save(`public/android-chrome-${size}x${size}.png`, await icon({ size, logo: 0.8 }), `${size} × ${size}`);
  }
  // Zone sûre des icônes « maskable » : un cercle de 80 % du côté.
  await save("public/maskable-icon-512x512.png", await icon({ size: 512, logo: 0.54 }), "512 × 512");

  // Favicon : carré arrondi, logo sur 80 % de la hauteur.
  const favicons = await Promise.all(
    FAVICON_SIZES.map(async (size) => ({ size, png: await icon({ size, logo: 0.8, radius: 0.22 }) })),
  );
  await save("app/favicon.ico", ico(favicons), FAVICON_SIZES.join(", ") + " px");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
