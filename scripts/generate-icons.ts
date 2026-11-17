/**
 * Génère les icônes du site depuis public/logo.png.
 *
 * Icônes principales : le logo noir, sa lettre « e » en blanc, entouré d’un
 * contour blanc arrondi, sur fond transparent. L’ensemble occupe toute la
 * hauteur de l’icône. Le noir se lit sur fond clair, le contour sur fond
 * sombre (vignettes de Chrome, onglets, résultats des moteurs de recherche).
 *
 *   public/apple-touch-icon.png        180 px    iOS et vignettes de Chrome
 *   public/android-chrome-192x192.png  192 px    manifeste, <link rel="icon">, résultats Google
 *   public/android-chrome-512x512.png  512 px    manifeste, logo des données structurées
 *   app/favicon.ico                    16 à 256  onglets et favoris
 *
 * Icône « maskable » du manifeste : Android la découpe et exige un fond plein,
 * elle garde donc le logo blanc sur le noir du thème (#0a0a0a), dans la zone sûre.
 *
 *   public/maskable-icon-512x512.png   512 px
 *
 * Usage : npx tsx scripts/generate-icons.ts
 */
import { writeFile } from "node:fs/promises";

import sharp from "sharp";

const LOGO = "public/logo.png";
const FAVICON_SIZES = [16, 32, 48, 64, 128, 256];
// Épaisseur du contour rapportée au côté de l’icône (1 px au minimum).
const OUTLINE = 0.035;
// Le contour est calculé en plus grand puis réduit, pour des bords lissés.
const SUPERSAMPLING = 4;
const PNG_OPTIONS = { palette: true, colors: 256, dither: 0, compressionLevel: 9, effort: 10 } as const;

// Distance euclidienne exacte de chaque pixel au pixel « intérieur » le plus
// proche (Felzenszwalb et Huttenlocher), ligne par ligne puis colonne par colonne.
function distanceToInside(inside: Uint8Array, size: number) {
  const INF = 1e20;
  const grid = new Float64Array(size * size);
  for (let i = 0; i < grid.length; i++) grid[i] = inside[i] ? 0 : INF;

  const f = new Float64Array(size);
  const d = new Float64Array(size);
  const v = new Int32Array(size);
  const z = new Float64Array(size + 1);
  const pass = (at: (line: number, index: number) => number) => {
    for (let line = 0; line < size; line++) {
      for (let q = 0; q < size; q++) f[q] = grid[at(line, q)];
      let k = 0;
      v[0] = 0;
      z[0] = -INF;
      z[1] = INF;
      for (let q = 1; q < size; q++) {
        let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
        while (s <= z[k]) {
          k--;
          s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
        }
        k++;
        v[k] = q;
        z[k] = s;
        z[k + 1] = INF;
      }
      k = 0;
      for (let q = 0; q < size; q++) {
        while (z[k + 1] < q) k++;
        d[q] = (q - v[k]) ** 2 + f[v[k]];
      }
      for (let q = 0; q < size; q++) grid[at(line, q)] = d[q];
    }
  };
  pass((row, x) => row * size + x);
  pass((column, y) => y * size + column);
  return grid.map(Math.sqrt);
}

async function outlinedIcon(size: number) {
  const canvas = size * SUPERSAMPLING;
  const outline = Math.max(1, Math.round(size * OUTLINE)) * SUPERSAMPLING;

  // Opacité du logo noir, centrée, contour compris sur toute la hauteur.
  const { data: logo, info } = await sharp(LOGO)
    .trim()
    .resize({ height: canvas - 2 * outline, kernel: "lanczos3" })
    .extractChannel("alpha")
    .raw()
    .toBuffer({ resolveWithObject: true });
  const alpha = new Uint8Array(canvas * canvas);
  const left = Math.round((canvas - info.width) / 2);
  for (let y = 0; y < info.height; y++) {
    alpha.set(logo.subarray(y * info.width, (y + 1) * info.width), (y + outline) * canvas + left);
  }

  // Silhouette pleine : tout ce que l’extérieur n’atteint pas, y compris la
  // lettre « e » évidée, qui sera donc remplie de blanc.
  const outside = new Uint8Array(canvas * canvas);
  const queue = new Int32Array(canvas * canvas);
  let head = 0;
  let tail = 0;
  const visit = (index: number) => {
    if (!outside[index] && alpha[index] < 128) {
      outside[index] = 1;
      queue[tail++] = index;
    }
  };
  for (let i = 0; i < canvas; i++) {
    visit(i);
    visit((canvas - 1) * canvas + i);
    visit(i * canvas);
    visit(i * canvas + canvas - 1);
  }
  while (head < tail) {
    const index = queue[head++];
    const x = index % canvas;
    if (x > 0) visit(index - 1);
    if (x < canvas - 1) visit(index + 1);
    if (index >= canvas) visit(index - canvas);
    if (index < canvas * (canvas - 1)) visit(index + canvas);
  }
  const inside = outside.map((value) => 1 - value);
  const distance = distanceToInside(inside, canvas);

  // Blanc partout où passe le contour, noir là où le logo est opaque.
  const rgba = Buffer.alloc(canvas * canvas * 4);
  for (let i = 0; i < alpha.length; i++) {
    const coverage = inside[i] ? 1 : Math.min(1, Math.max(0, outline + 0.5 - distance[i]));
    const shade = 255 - alpha[i];
    rgba[i * 4] = shade;
    rgba[i * 4 + 1] = shade;
    rgba[i * 4 + 2] = shade;
    rgba[i * 4 + 3] = Math.round(coverage * 255);
  }

  return sharp(rgba, { raw: { width: canvas, height: canvas, channels: 4 } })
    .resize(size, size, { kernel: "lanczos3" })
    .png(PNG_OPTIONS)
    .toBuffer();
}

// Logo blanc sur fond noir, dans le cercle de 80 % que garantit Android.
async function maskableIcon(size: number) {
  const mark = await sharp(LOGO)
    .negate({ alpha: false })
    .trim()
    .resize({ height: Math.round(size * 0.54), kernel: "lanczos3" })
    .toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 10, g: 10, b: 10, alpha: 1 } } })
    .composite([{ input: mark, gravity: "centre" }])
    .png(PNG_OPTIONS)
    .toBuffer();
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
  await save("public/apple-touch-icon.png", await outlinedIcon(180), 180);
  for (const size of [192, 512]) {
    await save(`public/android-chrome-${size}x${size}.png`, await outlinedIcon(size), size);
  }
  await save("public/maskable-icon-512x512.png", await maskableIcon(512), 512);

  const favicons = await Promise.all(FAVICON_SIZES.map(async (size) => ({ size, png: await outlinedIcon(size) })));
  await save("app/favicon.ico", ico(favicons), `${FAVICON_SIZES.join(", ")} px`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
