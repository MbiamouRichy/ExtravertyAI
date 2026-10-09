import { MAX_MEDIA_BYTES } from "./chat-media";

// MediaRecorder WebM files can omit duration metadata. Decode the bounded
// audio payload without playback to recover its duration before listening.
export async function resolveAudioDuration(src: string, signal: AbortSignal) {
  const response = await fetch(src, { signal });
  if (!response.ok) throw new Error("AUDIO_UNAVAILABLE");
  const bytes = await response.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > MAX_MEDIA_BYTES)
    throw new Error("AUDIO_SIZE");
  signal.throwIfAborted();
  const context = new OfflineAudioContext(1, 1, 48000);
  const decoded = await context.decodeAudioData(bytes);
  signal.throwIfAborted();
  if (!Number.isFinite(decoded.duration) || decoded.duration <= 0)
    throw new Error("AUDIO_DURATION");
  return decoded.duration;
}
