"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Loader2, Pause, Play, Sparkles } from "lucide-react";
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
export type AudioTranscript =
  { state: "ready"; text: string } | { state: "pending" } | { state: "failed" };

const BAR_COUNT = 30;
// Placeholder stable avant le calcul des pics réels (évite un saut visuel).
const PLACEHOLDER = [
  0.35, 0.6, 0.45, 0.8, 0.5, 0.95, 0.45, 0.7, 0.35, 0.6, 0.85, 0.5, 0.35, 0.75,
  0.45, 0.6, 0.3, 0.55, 0.75, 0.45, 0.35, 0.55, 0.3, 0.6, 0.45, 0.8, 0.5, 0.4,
  0.6, 0.35,
];

/** Réduit les pics décodés à quelques barres lisibles (maximum par segment). */
function waveformBars(peaks: number[]) {
  if (!peaks.length) return PLACEHOLDER;
  const max = Math.max(...peaks, 0.01);
  return Array.from({ length: BAR_COUNT }, (_, bar) => {
    const start = Math.floor((bar * peaks.length) / BAR_COUNT);
    const end = Math.max(
      start + 1,
      Math.floor(((bar + 1) * peaks.length) / BAR_COUNT),
    );
    return Math.max(...peaks.slice(start, end)) / max;
  });
}

export function AudioPlayer({
  src,
  onError,
  className,
  transcript,
  footer,
  outgoing = false,
}: {
  src: string;
  /** Message envoyé par l’équipe : reprend le thème sombre des bulles agent. */
  outgoing?: boolean;
  className?: string;
  onError?: () => void;
  /** Transcription IA affichée dans la bulle, sous le lecteur. */
  transcript?: AudioTranscript | null;
  /** Heure et statut d’envoi, affichés en bas de la bulle. */
  footer?: ReactNode;
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
        "w-80 max-w-full space-y-2.5 rounded-2xl p-2.5 shadow-xs",
        outgoing
          ? "rounded-br-md bg-primary text-primary-foreground"
          : "rounded-bl-md border bg-background",
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
      <div className="flex items-start gap-2.5">
        <Button
          type="button"
          size="icon"
          variant={outgoing ? "secondary" : "default"}
          className="size-9 shrink-0 rounded-full"
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
              className="size-4 animate-spin motion-reduce:animate-none"
            />
          ) : playing ? (
            <Pause aria-hidden="true" className="size-4 fill-current" />
          ) : (
            <Play aria-hidden="true" className="ml-0.5 size-4 fill-current" />
          )}
        </Button>

        <div className="min-w-0 flex-1">
          <div className="relative">
            {/* Barres arrondies façon maquette : la partie écoutée est pleine. */}
            <span
              aria-hidden="true"
              className="pointer-events-none flex h-8 items-center justify-between gap-0.5 overflow-hidden"
            >
              {waveformBars(peaks).map((peak, index, bars) => (
                <span
                  key={index}
                  className={cn(
                    "min-w-0.5 max-w-1 flex-1 rounded-full bg-current transition-opacity duration-150",
                    duration && index / bars.length < position / duration
                      ? "opacity-100"
                      : "opacity-35",
                  )}
                  style={{
                    height: `${Math.round(Math.max(0.18, peak) * 100)}%`,
                  }}
                />
              ))}
            </span>
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
          {/* Temps écouté à gauche, durée totale à droite, sous la piste. */}
          <div className="mt-0.5 flex items-center justify-between font-mono text-[10px] tabular-nums opacity-70">
            <span aria-label="Temps écouté">{time(position)}</span>
            <span aria-label="Durée du message audio">
              {duration ? time(duration) : "--:--"}
            </span>
          </div>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={cn(
                "mt-0.5 h-7 shrink-0 gap-0.5 rounded-full border px-2 text-xs tabular-nums",
                outgoing &&
                  "border-primary-foreground/25 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground",
              )}
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
        <p role="status" className="px-1 text-xs text-destructive">
          Lecture indisponible.
        </p>
      )}
      {transcript && (
        <AiInsight
          insight={transcript}
          label="Transcription IA"
          className={
            outgoing
              ? "bg-primary-foreground/10 text-primary-foreground [&_.text-muted-foreground]:text-primary-foreground/70"
              : undefined
          }
        />
      )}
      {footer}
    </div>
  );
}

/** Bloc repliable « Transcription IA » / « Analyse IA » affiché dans une bulle. */
export function AiInsight({
  insight,
  label,
  className,
}: {
  insight: AudioTranscript;
  label: string;
  className?: string;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div
      className={cn(
        "rounded-xl bg-muted/70 px-3 py-2 text-sm text-foreground",
        className,
      )}
    >
      {insight.state === "ready" ? (
        <>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="flex items-center gap-1.5 rounded-sm text-[10px] font-medium uppercase tracking-wider text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Sparkles aria-hidden="true" className="size-3" />
            {label}
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "size-3 transition-transform",
                !open && "-rotate-90",
              )}
            />
          </button>
          {open && (
            <p
              dir="auto"
              className="mt-1 whitespace-pre-wrap leading-relaxed wrap-anywhere"
            >
              {insight.text}
            </p>
          )}
        </>
      ) : (
        <p
          role="status"
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          {insight.state === "pending" ? (
            <>
              <Loader2
                aria-hidden="true"
                className="size-3 animate-spin motion-reduce:animate-none"
              />
              Analyse en cours…
            </>
          ) : (
            "Analyse indisponible. Le média reste consultable."
          )}
        </p>
      )}
    </div>
  );
}
