import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PROJECT_LOGO_MAX_BYTES,
  checkLogoFile,
  isProjectLogoKey,
  logoDimensions,
  projectLogoKey,
  projectLogoUrl,
  sniffLogoType,
} from "../lib/project-logo";

const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));
const be16 = (value: number) => [value >> 8, value & 0xff];
const be32 = (value: number) => [...be16(value >>> 16), ...be16(value & 0xffff)];
const le16 = (value: number) => [value & 0xff, value >> 8];
const le24 = (value: number) => [value & 0xff, (value >> 8) & 0xff, value >> 16];

function png(width: number, height: number) {
  return Uint8Array.from([
    0x89, ...ascii("PNG\r\n\x1a\n"), ...be32(13), ...ascii("IHDR"),
    ...be32(width), ...be32(height), 8, 6, 0, 0, 0, 0, 0, 0, 0,
  ]);
}

function jpeg(width: number, height: number) {
  return Uint8Array.from([
    0xff, 0xd8,
    // APP0 (JFIF), puis une table de Huffman (C4) à ignorer, puis SOF2.
    0xff, 0xe0, ...be16(16), ...ascii("JFIF\0"), 1, 1, 0, 0, 1, 0, 1, 0, 0,
    0xff, 0xc4, ...be16(4), 0, 0,
    0xff, 0xc2, ...be16(17), 8, ...be16(height), ...be16(width), 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1,
  ]);
}

const riff = (chunk: number[]) => Uint8Array.from([...ascii("RIFF"), ...le24(chunk.length + 4), 0, ...ascii("WEBP"), ...chunk]);
const webpX = (width: number, height: number) =>
  riff([...ascii("VP8X"), 10, 0, 0, 0, 0, 0, 0, 0, ...le24(width - 1), ...le24(height - 1)]);
const webpLossless = (width: number, height: number) => {
  const bits = ((width - 1) | ((height - 1) << 14)) >>> 0;
  return riff([...ascii("VP8L"), 5, 0, 0, 0, 0x2f, bits & 0xff, (bits >> 8) & 0xff, (bits >> 16) & 0xff, bits >>> 24]);
};
const webpLossy = (width: number, height: number) =>
  riff([...ascii("VP8 "), 10, 0, 0, 0, 0, 0, 0, 0x9d, 0x01, 0x2a, ...le16(width), ...le16(height)]);

test("logo dimensions are read from the file header, never decoded", () => {
  assert.deepEqual(logoDimensions(png(512, 256), "image/png"), { width: 512, height: 256 });
  assert.deepEqual(logoDimensions(jpeg(800, 600), "image/jpeg"), { width: 800, height: 600 });
  assert.deepEqual(logoDimensions(webpX(1024, 768), "image/webp"), { width: 1024, height: 768 });
  assert.deepEqual(logoDimensions(webpLossless(300, 200), "image/webp"), { width: 300, height: 200 });
  assert.deepEqual(logoDimensions(webpLossy(640, 480), "image/webp"), { width: 640, height: 480 });
  // En-tête tronqué, JPEG sans SOF avant les données, chunk inconnu : illisible.
  assert.equal(logoDimensions(png(512, 512).subarray(0, 20), "image/png"), null);
  assert.equal(logoDimensions(Uint8Array.from([0xff, 0xd8, 0xff, 0xda, 0, 8, 0, 0, 0, 0, 0, 0]), "image/jpeg"), null);
  assert.equal(logoDimensions(riff([...ascii("ABCD"), 0, 0, 0, 0, ...Array(12).fill(0)]), "image/webp"), null);
});

test("an uploaded logo is checked for size, real type and dimensions", () => {
  assert.deepEqual(checkLogoFile(png(512, 512)), { ok: true, type: "image/png" });
  assert.deepEqual(checkLogoFile(jpeg(1200, 1200)), { ok: true, type: "image/jpeg" });
  const refused = (bytes: Uint8Array, message: RegExp) => {
    const result = checkLogoFile(bytes);
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, message);
  };
  refused(new Uint8Array(), /2 Mo/);
  const heavy = new Uint8Array(PROJECT_LOGO_MAX_BYTES + 1);
  heavy.set(png(512, 512));
  refused(heavy, /2 Mo/);
  refused(new TextEncoder().encode("<svg onload=alert(1)>"), /JPEG, PNG ou WEBP/);
  refused(png(512, 512).subarray(0, 16), /illisible/);
  // Bombe de décompression : quelques octets, des milliards de pixels.
  refused(png(60_000, 60_000), /trop grande/);
  refused(webpX(16_384, 16_384), /trop grande/);
  refused(png(16, 16), /trop petite/);
});

test("project logos are checked by content and bound to their project", () => {
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]);
  const webp = new TextEncoder().encode("RIFF0000WEBPVP8 ");
  assert.equal(sniffLogoType(png), "image/png");
  assert.equal(sniffLogoType(jpeg), "image/jpeg");
  assert.equal(sniffLogoType(webp), "image/webp");
  // Un SVG ou un HTML renommé en image est refusé.
  assert.equal(sniffLogoType(new TextEncoder().encode("<svg onload=alert(1)>")), null);

  const id = "1b4e28ba-2fa1-11d2-883f-0016d3cca427";
  const key = projectLogoKey("projet-a", id, "image/png");
  assert.equal(isProjectLogoKey("projet-a", key), true);
  // Une clé d’un autre projet ou détournée n’est jamais servie.
  assert.equal(isProjectLogoKey("projet-b", key), false);
  assert.equal(isProjectLogoKey("projet-a", "profiles/../secret.png"), false);
  assert.equal(projectLogoUrl("projet-a", key), "/api/projects/projet-a/logo?v=1b4e28ba");
  assert.equal(projectLogoUrl("projet-a", null), null);
});
