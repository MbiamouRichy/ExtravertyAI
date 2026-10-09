"use client";
import { useEffect, useRef, useState } from "react";
import { Loader2, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
const time = (seconds: number) =>
  Math.floor(seconds / 60) +
  ":" +
  String(Math.floor(seconds % 60)).padStart(2, "0");
export function AudioPlayer({
  src,
  onError,
}: {
  src: string;
  onError?: () => void;
}) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [rate, setRate] = useState(1);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const audio = ref.current;
    const pauseOther = (event: Event) => {
      if ((event as CustomEvent).detail !== audio) audio?.pause();
    };
    document.addEventListener("chat-audio-play", pauseOther);
    return () => {
      audio?.pause();
      document.removeEventListener("chat-audio-play", pauseOther);
    };
  }, []);
  return (
    <div className="w-64 max-w-full rounded-2xl border border-border/60 bg-muted/40 px-3 py-2 sm:w-72">
      <audio
        ref={ref}
        src={src}
        preload="metadata"
        onLoadedMetadata={() => {
          const d = ref.current?.duration;
          if (d && Number.isFinite(d)) setDuration(d);
        }}
        onDurationChange={() => {
          const d = ref.current?.duration;
          if (d && Number.isFinite(d)) setDuration(d);
        }}
        onTimeUpdate={() => setPosition(ref.current?.currentTime ?? 0)}
        onPlay={() => {
          setPlaying(true);
          document.dispatchEvent(
            new CustomEvent("chat-audio-play", { detail: ref.current }),
          );
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          const end = ref.current?.currentTime ?? 0;
          if (end > 0 && Number.isFinite(end)) setDuration(end);
        }}
        onWaiting={() => setLoading(true)}
        onPlaying={() => setLoading(false)}
        onCanPlay={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setFailed(true);
          onError?.();
        }}
      />
      <div className="flex items-center gap-3">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="shrink-0 rounded-full"
          aria-label={
            playing ? "Mettre l’audio en pause" : "Écouter le message audio"
          }
          disabled={failed}
          onClick={async () => {
            const audio = ref.current;
            if (!audio) return;
            if (playing) audio.pause();
            else {
              try {
                setLoading(true);
                await audio.play();
              } catch {
                setFailed(true);
                onError?.();
              } finally {
                setLoading(false);
              }
            }
          }}
        >
          {loading ? (
            <Loader2
              aria-hidden="true"
              className="size-5 animate-spin motion-reduce:animate-none"
            />
          ) : playing ? (
            <Pause aria-hidden="true" className="size-5" />
          ) : (
            <Play aria-hidden="true" className="size-5" />
          )}
        </Button>
        <div className="min-w-0 flex-1 space-y-2">
          <Slider
            aria-label="Position dans le message audio"
            min={0}
            max={duration || 1}
            step={0.1}
            value={[Math.min(position, duration || 1)]}
            disabled={!duration || failed}
            onValueChange={([value]) => {
              if (ref.current) {
                ref.current.currentTime = value;
                setPosition(value);
              }
            }}
          />
          <div className="flex justify-between gap-2 text-xs tabular-nums text-muted-foreground">
            <span>{time(position)}</span>
            <span>{duration ? time(duration) : "--:--"}</span>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="shrink-0 tabular-nums"
          aria-label={"Vitesse de lecture : " + rate + " fois"}
          onClick={() => {
            const next = rate === 2 ? 1 : rate + 0.5;
            setRate(next);
            if (ref.current) ref.current.playbackRate = next;
          }}
        >
          {rate}×
        </Button>
      </div>
      {failed && (
        <p role="status" className="mt-2 text-xs text-destructive">
          Lecture indisponible.
        </p>
      )}
    </div>
  );
}
