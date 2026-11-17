/** Icône de l’entreprise : mêmes formats et taille que les photos de profil. */
export const PROJECT_LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const PROJECT_LOGO_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;
export type ProjectLogoType = keyof typeof PROJECT_LOGO_TYPES;

const KEY_PATTERN = /^project-logos\/([^/]+)\/([\da-f-]{36})\.(jpg|png|webp)$/;

export function projectLogoKey(
  projectId: string,
  id: string,
  type: ProjectLogoType,
) {
  return `project-logos/${projectId}/${id}.${PROJECT_LOGO_TYPES[type]}`;
}

/** Clé valide et rattachée à ce projet uniquement. */
export function isProjectLogoKey(
  projectId: string,
  key: string | null,
): key is string {
  const match = key ? KEY_PATTERN.exec(key) : null;
  return !!match && match[1] === projectId;
}

/** Adresse servie à l’interface ; `v` change à chaque nouvelle icône (cache). */
export function projectLogoUrl(projectId: string, logoKey: string | null) {
  if (!isProjectLogoKey(projectId, logoKey)) return null;
  const version = KEY_PATTERN.exec(logoKey)?.[2].slice(0, 8);
  return `/api/projects/${encodeURIComponent(projectId)}/logo?v=${version}`;
}

/** Vérifie le contenu réel du fichier, pas seulement le type annoncé. */
export function sniffLogoType(bytes: Uint8Array): ProjectLogoType | null {
  const ascii = (start: number, end: number) =>
    String.fromCharCode(...bytes.subarray(start, end));
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
  if (ascii(0, 8) === "\x89PNG\r\n\x1a\n") return "image/png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

/** Côtés admis : assez net pour une icône, jamais une bombe de décompression. */
export const PROJECT_LOGO_SIDE = { min: 32, max: 4096 } as const;

type Size = { width: number; height: number };

/**
 * Dimensions lues dans l’en-tête du fichier, sans le décoder. Un en-tête
 * absent, tronqué ou incohérent donne null : le fichier est refusé.
 */
export function logoDimensions(bytes: Uint8Array, type: ProjectLogoType): Size | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (start: number, end: number) =>
    String.fromCharCode(...bytes.subarray(start, end));
  const fits = (end: number) => end <= bytes.length;
  if (type === "image/png") {
    if (!fits(24) || ascii(12, 16) !== "IHDR") return null;
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (type === "image/webp") {
    const chunk = ascii(12, 16);
    if (chunk === "VP8 " && fits(30) && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a)
      return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
    if (chunk === "VP8L" && fits(25) && bytes[20] === 0x2f) {
      const bits = view.getUint32(21, true);
      return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
    }
    if (chunk === "VP8X" && fits(30)) {
      const u24 = (at: number) => bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16);
      return { width: u24(24) + 1, height: u24(27) + 1 };
    }
    return null;
  }
  // JPEG : premier segment SOFn (hors DHT, JPG et DAC).
  let at = 2;
  while (fits(at + 4)) {
    if (bytes[at] !== 0xff) return null;
    const marker = bytes[at + 1];
    if (marker === 0xff) {
      at += 1;
      continue;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      at += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) return null;
    const length = view.getUint16(at + 2);
    if (length < 2) return null;
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker))
      return fits(at + 9)
        ? { width: view.getUint16(at + 7), height: view.getUint16(at + 5) }
        : null;
    at += 2 + length;
  }
  return null;
}

/**
 * Contrôle complet d’une icône reçue : taille, type réel et dimensions.
 * Le message est destiné à l’utilisateur.
 */
export function checkLogoFile(
  bytes: Uint8Array,
): { ok: true; type: ProjectLogoType } | { ok: false; error: string } {
  if (!bytes.length || bytes.length > PROJECT_LOGO_MAX_BYTES)
    return { ok: false, error: "Choisissez une image de 2 Mo au maximum." };
  const type = sniffLogoType(bytes);
  if (!type) return { ok: false, error: "Formats acceptés : JPEG, PNG ou WEBP." };
  const size = logoDimensions(bytes, type);
  if (!size) return { ok: false, error: "Cette image est illisible. Choisissez-en une autre." };
  const { min, max } = PROJECT_LOGO_SIDE;
  if (Math.min(size.width, size.height) < min)
    return { ok: false, error: `Image trop petite : ${min} × ${min} pixels au minimum.` };
  if (Math.max(size.width, size.height) > max)
    return { ok: false, error: `Image trop grande : ${max} × ${max} pixels au maximum.` };
  return { ok: true, type };
}
