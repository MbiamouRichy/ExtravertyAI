"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { resolveAudioWaveform } from "@/lib/audio-duration";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
const time = (seconds: number) =>
  Math.floor(seconds / 60) +
  ":" +
  String(Math.floor(seconds % 60)).padStart(2, "0");
export function AudioPlayer({
  src,
  onError,
  className,
}: {
  src: string;
  className?: string;
  onError?: () => void;
}) {
  const ref = useRef<HTMLAudioElement>(null);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [rate, setRate] = useState(1);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const audio = ref.current;
    const controller = new AbortController();
    let resolving = false;
    const updateDuration = () => {
      if (!audio) return;
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
      if (!resolving) {
        resolving = true;
        void resolveAudioWaveform(src, controller.signal)
          .then((result) => {
            setDuration(result.duration);
            setPeaks(result.peaks);
          })
          .catch(() => {
            // Metadata failure must not prevent native playback.
          });
      }
    };
    audio?.addEventListener("loadedmetadata", updateDuration);
    audio?.addEventListener("durationchange", updateDuration);
    if (audio && audio.readyState >= 1) updateDuration();
    const pauseOther = (event: Event) => {
      if ((event as CustomEvent).detail !== audio) audio?.pause();
    };
    document.addEventListener("chat-audio-play", pauseOther);
    return () => {
      controller.abort();
      audio?.removeEventListener("loadedmetadata", updateDuration);
      audio?.removeEventListener("durationchange", updateDuration);
      audio?.pause();
      document.removeEventListener("chat-audio-play", pauseOther);
    };
  }, [src]);
  return (
    <div
      className={cn(
        "w-80 max-w-full rounded-full border border-border/60 bg-muted/40 px-3 py-2",
        className,
      )}
    >
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

        <div className="relative min-w-0 flex-1">
          <svg
            aria-hidden="true"
            viewBox="0 0 144 32"
            preserveAspectRatio="none"
            className="pointer-events-none h-9 w-full"
          >
            {(peaks.length ? peaks : Array(48).fill(0.08)).map(
              (peak, index) => {
                const height = Math.max(3, peak * 28);
                return (
                  <rect
                    key={index}
                    x={index * 3}
                    y={(32 - height) / 2}
                    width="1.5"
                    height={height}
                    rx="0.75"
                    className={
                      duration && index / 48 < position / duration
                        ? "fill-primary"
                        : "fill-muted-foreground/40"
                    }
                  />
                );
              },
            )}
          </svg>
          <Slider
            className="absolute inset-0 min-h-9 [&_[data-slot=slider-track]]:opacity-0 [&_[data-slot=slider-thumb]]:opacity-0 [&_[data-slot=slider-thumb]:focus-visible]:opacity-100"
            aria-label="Position dans le message audio"
            aria-valuetext={time(position) + " sur " + time(duration)}
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
        </div>
        <span
          className="shrink-0 text-xs tabular-nums text-muted-foreground"
          aria-label="Temps de lecture"
        >
          {position > 0 ? time(position) + " / " : ""}
          {duration ? time(duration) : "--:--"}
        </span>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="shrink-0 gap-1 rounded-full px-2 tabular-nums"
              aria-label={
                "Vitesse de lecture : " + rate.toLocaleString("fr-FR") + " fois"
              }
              disabled={failed}
            >
              {rate.toLocaleString("fr-FR")}×
              <ChevronDown aria-hidden="true" className="size-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" aria-label="Réglage de la vitesse">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span>Vitesse de lecture</span>
              <output className="font-medium tabular-nums">
                {rate.toLocaleString("fr-FR")}×
              </output>
            </div>
            <Slider
              className="min-h-9"
              aria-label="Vitesse de lecture"
              aria-valuetext={rate.toLocaleString("fr-FR") + " fois"}
              min={0.5}
              max={2}
              step={0.25}
              value={[rate]}
              onValueChange={([value]) => {
                setRate(value);
                if (ref.current) ref.current.playbackRate = value;
              }}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0,5×</span>
              <span>2×</span>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      {failed && (
        <p role="status" className="mt-2 text-xs text-destructive">
          Lecture indisponible.
        </p>
      )}
    </div>
  );
}
