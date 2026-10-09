import { MAX_MEDIA_BYTES } from "./chat-media";

// MediaRecorder WebM files can omit duration metadata. Decode the bounded
// audio payload without playback to recover its duration before listening.
async function decodeAudio(src: string, signal: AbortSignal) {
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
  return decoded;
}

export async function resolveAudioDuration(src: string, signal: AbortSignal) {
  return (await decodeAudio(src, signal)).duration;
}
export async function resolveAudioWaveform(src: string, signal: AbortSignal) {
  const decoded = await decodeAudio(src, signal);
  const samples = decoded.getChannelData(0);
  const peaks = Array.from({ length: 48 }, (_, index) => {
    const start = Math.floor((index * samples.length) / 48);
    const end = Math.floor(((index + 1) * samples.length) / 48);
    let peak = 0;
    for (let i = start; i < end; i++)
      peak = Math.max(peak, Math.abs(samples[i]));
    return peak;
  });
  const max = Math.max(...peaks, 0.01);
  return { duration: decoded.duration, peaks: peaks.map((peak) => peak / max) };
}
