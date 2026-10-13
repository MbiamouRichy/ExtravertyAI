export type AiMessageContent = {
  type: string;
  content: string;
  extractedText?: string | null;
  extractionStatus?: string | null;
};
export function hasExtractedText(message: AiMessageContent) {
  return (
    (message.type === "AUDIO" || message.type === "IMAGE") &&
    message.extractionStatus === "COMPLETED" &&
    !!message.extractedText?.trim()
  );
}
// All AI consumers share this representation; media placeholders are not evidence.
export function messageAiContent(message: AiMessageContent): string {
  if (message.type === "TEXT") return message.content;
  if (hasExtractedText(message)) {
    const label =
      message.type === "AUDIO"
        ? "Transcription audio"
        : "Description extraite de l’image";
    const caption =
      message.type === "IMAGE" &&
      message.content.trim() &&
      message.content !== "[IMAGE]"
        ? "[Légende du client]\n" + message.content.trim() + "\n\n"
        : "";
    return caption + "[" + label + "]\n" + message.extractedText!.trim();
  }
  return "[Pièce jointe " + message.type + ", contenu non analysé]";
}
