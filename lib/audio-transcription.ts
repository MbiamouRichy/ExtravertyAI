import { z } from "zod";
import { MEDIA_TYPES } from "./chat-media";
import { readLimitedBody, validateMediaBytes } from "./chat-media-server";

export const TRANSCRIPTION_MODELS = [
  "openai/whisper-large-v3-turbo",
  "mistralai/voxtral-mini-3b-2507",
] as const;
export const TRANSCRIPTION_VERSION = 1;
export const TranscriptSchema = z.object({
  text: z.string().trim().min(1).max(60_000),
  model: z.enum(TRANSCRIPTION_MODELS),
});
export class TranscriptionError extends Error {
  constructor(
    public code: string,
    public retryable = true,
  ) {
    super(code);
  }
}
export async function transcribeAudio(media: { bytes: Buffer; mime: string }) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new TranscriptionError("TRANSCRIPTION_CONFIG_MISSING", false);
  if (!media.mime.startsWith("audio/"))
    throw new TranscriptionError("TRANSCRIPTION_INVALID_MEDIA", false);
  validateMediaBytes(media.bytes, media.mime);
  const format = MEDIA_TYPES[media.mime];
  let lastError = new TranscriptionError("TRANSCRIPTION_FAILED");
  for (const model of TRANSCRIPTION_MODELS) {
    try {
      const response = await fetch(
        "https://openrouter.ai/api/v1/audio/transcriptions",
        {
          method: "POST",
          redirect: "error",
          signal: AbortSignal.timeout(65_000),
          headers: {
            Authorization: "Bearer " + key,
            "Content-Type": "application/json",
            "X-Title": "ExtravertyAI",
          },
          body: JSON.stringify({
            model,
            input_audio: { data: media.bytes.toString("base64"), format },
            response_format: "json",
          }),
        },
      );
      if (!response.ok) {
        // Account/auth errors affect both models. Do not spend another request.
        const accountError = [401, 402, 403].includes(response.status);
        throw new TranscriptionError(
          "TRANSCRIPTION_HTTP_" + response.status,
          !accountError,
        );
      }
      const bytes = await readLimitedBody(response.body, 512_000);
      const payload = JSON.parse(bytes.toString());
      return TranscriptSchema.parse({ text: payload?.text, model });
    } catch (error) {
      if (error instanceof TranscriptionError && !error.retryable) throw error;
      lastError =
        error instanceof TranscriptionError
          ? error
          : new TranscriptionError("TRANSCRIPTION_INVALID_OR_EMPTY_RESPONSE");
    }
  }
  throw lastError;
}
