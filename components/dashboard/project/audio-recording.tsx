"use client";

import { useEffect, useRef } from "react";
import { Loader2, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";

// Profil de repos repris de la maquette : des barres variées, jamais plates.
const BASE = [
  0.4, 0.7, 0.5, 0.9, 0.6, 1, 0.5, 0.8, 0.4, 0.7, 0.9, 0.6, 0.4, 0.8, 0.5,
  0.7, 0.3, 0.6, 0.8, 0.5, 0.4, 0.6, 0.3, 0.7, 0.5, 0.8,
];
const BAR_COUNT = BASE.length;
const STEP = 7.5;
const VIEW_WIDTH = BAR_COUNT * STEP;
const idleHeight = (index: number) => 5 + BASE[index] * 13;

export function AudioRecording({
  stream,
  preparing,
  seconds,
  onCancel,
  onStop,
}: {
  stream: MediaStream | null;
  preparing: boolean;
  seconds: number;
  onCancel: () => void;
  onStop: () => void;
}) {
  const spectrum = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!stream || !spectrum.current) return;
    const bars = Array.from(spectrum.current.querySelectorAll("rect"));
    let context: AudioContext | undefined;
    let source: MediaStreamAudioSourceNode | undefined;
    let analyser: AnalyserNode | undefined;
    let frame = 0;
    let lastFrame = 0;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    try {
      context = new AudioContext();
      source = context.createMediaStreamSource(stream);
      analyser = context.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.75;
      source.connect(analyser);
      // Analyse locally without connecting the microphone to the speakers.
      void context.resume().catch(() => {});
      const samples = new Uint8Array(analyser.fftSize);
      let level = 0;
      const draw = (now: number) => {
        frame = requestAnimationFrame(draw);
        if (now - lastFrame < (reducedMotion ? 200 : 33)) return;
        lastFrame = now;
        analyser!.getByteTimeDomainData(samples);
        let energy = 0;
        for (const sample of samples) energy += ((sample - 128) / 128) ** 2;
        // Gate quiet room noise; every bar follows the same live voice level.
        const rms = Math.sqrt(energy / samples.length);
        const target = rms < 0.012 ? 0 : Math.min(1, (rms - 0.012) * 12);
        level += (target - level) * (target > level ? 0.65 : 0.4);
        if (level < 0.01) level = 0;
        bars.forEach((bar, index) => {
          const wave =
            0.35 + 0.65 * Math.abs(Math.sin(index * 0.55 - now / 180));
          // Au repos : profil de la maquette ; la voix amplifie chaque barre.
          const height = Math.min(
            42,
            idleHeight(index) + level * (0.45 + 0.55 * wave) * 26,
          );
          bar.setAttribute("height", String(height));
          bar.setAttribute("y", String((44 - height) / 2));
        });
      };
      frame = requestAnimationFrame(draw);
    } catch {
      // Recording remains available when Web Audio visualisation is unsupported.
    }
    return () => {
      cancelAnimationFrame(frame);
      source?.disconnect();
      analyser?.disconnect();
      if (context && context.state !== "closed")
        void context.close().catch(() => {});
    };
  }, [stream]);

  const time =
    Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");

  return (
    <section
      aria-label="Enregistrement du message vocal"
      className="min-w-0 space-y-2 px-3 py-2.5"
    >
      <div className="flex items-center justify-between gap-2 text-xs">
        <span
          role="status"
          className="flex min-w-0 items-center gap-2 font-medium"
        >
          {preparing ? (
            <Loader2
              aria-hidden="true"
              className="size-3.5 shrink-0 animate-spin motion-reduce:animate-none"
            />
          ) : (
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-full bg-destructive motion-safe:animate-pulse"
            />
          )}
          {preparing ? "Autorisation du microphone…" : "Enregistrement"}
        </span>
        {!preparing && (
          <span
            role="timer"
            aria-label={"Durée enregistrée : " + time}
            className="shrink-0 font-mono tabular-nums"
          >
            {time}
            <span className="text-muted-foreground"> / 2:00</span>
          </span>
        )}
      </div>
      <div className="flex min-w-0 items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 rounded-full"
          aria-label="Annuler l’enregistrement"
          title="Annuler l’enregistrement"
          onClick={onCancel}
        >
          <X aria-hidden="true" />
        </Button>
        <svg
          ref={spectrum}
          aria-hidden="true"
          viewBox={`0 0 ${VIEW_WIDTH} 44`}
          preserveAspectRatio="xMidYMid meet"
          className="h-11 min-w-0 flex-1 text-muted-foreground"
        >
          {Array.from({ length: BAR_COUNT }, (_, index) => (
            <rect
              key={index}
              x={index * STEP + 1.5}
              y={(44 - idleHeight(index)) / 2}
              width={4.5}
              height={idleHeight(index)}
              rx={2.25}
              fill="currentColor"
            />
          ))}
        </svg>
        <Button
          type="button"
          variant="default"
          size="icon"
          className="shrink-0 rounded-full"
          disabled={preparing}
          aria-label="Arrêter et écouter"
          title="Arrêter et écouter"
          onClick={onStop}
        >
          <Square aria-hidden="true" className="size-4 fill-current" />
        </Button>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Arrêtez pour écouter avant l’envoi.
      </p>
    </section>
  );
}
