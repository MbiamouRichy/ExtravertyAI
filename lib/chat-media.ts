export const MAX_MEDIA_BYTES = 4 * 1024 * 1024;
export const MEDIA_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/wav": "wav",
  "audio/webm": "webm",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.ms-excel": "xls",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    "pptx",
  "text/plain": "txt",
  "text/csv": "csv",
  "application/zip": "zip",
} as const;
export type MediaMime = keyof typeof MEDIA_TYPES;
export type ChatAttachment = {
  token: string;
  type: "IMAGE" | "AUDIO" | "VIDEO" | "DOCUMENT";
  requestId: string;
};
export function mediaFileError(file: {
  size: number;
  type: string;
  name?: string;
}) {
  if (!Object.hasOwn(MEDIA_TYPES, mediaMimeForFile(file)))
    return "Formats acceptés : images, audio, MP4, WebM, PDF, Word, Excel, PowerPoint, TXT, CSV et ZIP.";
  if (!file.size || file.size > MAX_MEDIA_BYTES)
    return "Choisissez un fichier non vide de 4 Mo maximum.";
  return null;
}
export function messageMediaPath(projectId: string, messageId: string) {
  return `/api/projects/${encodeURIComponent(projectId)}/chat/media/${encodeURIComponent(messageId)}`;
}
export function chatMediaFields(
  message: {
    id: string;
    type: string;
    content: string;
    extractedText?: string | null;
    extractionStatus?: string | null;
  },
  projectId: string,
) {
  const supported = ["IMAGE", "AUDIO", "VIDEO", "DOCUMENT"].includes(
    message.type,
  );
  return {
    ...(message.extractionStatus
      ? {
          extractionStatus: message.extractionStatus,
          extractedText:
            message.extractionStatus === "COMPLETED"
              ? (message.extractedText ?? null)
              : null,
        }
      : {}),
    type: message.type,
    mediaUrl: supported ? messageMediaPath(projectId, message.id) : null,
    content: supported
      ? message.content === `[${message.type}]`
        ? ""
        : message.content
      : message.type === "TEXT"
        ? message.content
        : `Pièce jointe (${message.type}) — aperçu non disponible.`,
  };
}

export function mediaKind(mime: string): ChatAttachment["type"] {
  return mime.startsWith("image/")
    ? "IMAGE"
    : mime.startsWith("audio/")
      ? "AUDIO"
      : mime.startsWith("video/")
        ? "VIDEO"
        : "DOCUMENT";
}
export function mediaMimeForFile(file: {
  type: string;
  name?: string;
}): string {
  if (Object.hasOwn(MEDIA_TYPES, file.type)) return file.type;
  if (file.type && file.type !== "application/octet-stream") return file.type;
  const extension = file.name?.split(".").at(-1)?.toLowerCase();
  if (extension === "webm") return "video/webm";
  return (
    Object.entries(MEDIA_TYPES).find(([, ext]) => ext === extension)?.[0] ??
    file.type
  );
}
/** Extensions reconnues pour chaque type, en plus de celle de `MEDIA_TYPES`. */
const EXTENSION_ALIASES: Partial<Record<MediaMime, readonly string[]>> = {
  "image/jpeg": ["jpeg", "jfif"],
  "audio/ogg": ["oga", "opus"],
  "audio/mp4": ["mp4"],
  "video/mp4": ["m4v"],
};
const MAX_FILENAME_LENGTH = 180;

/**
 * Nom affiché, stocké et transmis à WhatsApp : celui du navigateur n’est
 * qu’indicatif. Sans chemin, caractères de contrôle ni inversion
 * bidirectionnelle (« photo\u202egnp.exe »), et toujours terminé par
 * l’extension du type vérifié : `facture.exe` envoyé comme PNG devient
 * `facture.exe.png`.
 */
export function safeMediaFilename(name: string, mime: string) {
  const known = Object.hasOwn(MEDIA_TYPES, mime);
  const extension = known ? MEDIA_TYPES[mime as MediaMime] : "bin";
  const accepted = [
    extension,
    ...((known && EXTENSION_ALIASES[mime as MediaMime]) || []),
  ];
  const cleaned = (name.split(/[\\/]/).at(-1) ?? "")
    .normalize("NFC")
    .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, "")
    .replace(/[<>:"|?*]/g, "_")
    .replace(/\s+/g, " ")
    // Ni fichier caché (« .htaccess ») ni point final (ignoré par Windows).
    .replace(/^[.\s]+|[.\s]+$/g, "");
  const dot = cleaned.lastIndexOf(".");
  const current = dot > 0 ? cleaned.slice(dot + 1) : "";
  const keep = accepted.includes(current.toLowerCase());
  const suffix = keep ? current : extension;
  const base = Array.from(keep ? cleaned.slice(0, dot) : cleaned)
    .slice(0, MAX_FILENAME_LENGTH - suffix.length - 1)
    .join("")
    .trim();
  return `${base || "fichier"}.${suffix}`;
}

/** Images qu’on peut coller dans le compositeur : celles déjà acceptées à l’envoi. */
export const CHAT_IMAGE_TYPES = Object.keys(MEDIA_TYPES).filter((mime) =>
  mime.startsWith("image/"),
) as Extract<MediaMime, `image/${string}`>[];

export function isChatImageType(
  mime: string,
): mime is (typeof CHAT_IMAGE_TYPES)[number] {
  return (CHAT_IMAGE_TYPES as string[]).includes(mime);
}

/**
 * Nom d’une image collée : le presse-papiers n’en donne pas (ou « image.png »).
 * Horodatage local, et un rang quand plusieurs images arrivent ensemble.
 */
export function pastedImageName(mime: string, date: Date, rank = 0) {
  const pad = (value: number) => String(value).padStart(2, "0");
  const stamp =
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return safeMediaFilename(
    `image-collée-${stamp}${rank ? `-${rank + 1}` : ""}`,
    mime,
  );
}

/** Le presse-papiers nomme souvent toute image « image.png » : nom à remplacer. */
export function isGenericPastedName(name: string) {
  return !name.trim() || /^image\.\w{2,5}$/i.test(name.trim());
}
