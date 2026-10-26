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
