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
} as const;
export type MediaMime = keyof typeof MEDIA_TYPES;
export type ChatAttachment = {
  token: string;
  type: "IMAGE" | "AUDIO";
  requestId: string;
};
export function mediaFileError(file: { size: number; type: string }) {
  if (!Object.hasOwn(MEDIA_TYPES, file.type))
    return "Formats acceptés : JPG, PNG, WebP, MP3, OGG, M4A, WAV ou WebM.";
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
  const supported = message.type === "IMAGE" || message.type === "AUDIO";
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
