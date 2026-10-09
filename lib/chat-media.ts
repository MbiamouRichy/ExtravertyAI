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
  message: { id: string; type: string; content: string },
  projectId: string,
) {
  const supported = ["IMAGE", "AUDIO", "VIDEO", "DOCUMENT"].includes(
    message.type,
  );
  return {
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
export function safeMediaFilename(name: string, mime: string) {
  const cleaned = name
    .split(/[\\/]/)
    .at(-1)
    ?.replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 180);
  return cleaned || "fichier." + (MEDIA_TYPES[mime as MediaMime] ?? "bin");
}
