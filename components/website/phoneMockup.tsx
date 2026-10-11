"use client";
import { useEffect, useRef, useState } from "react";
import { Loader2, Pause, Play, VideoOff } from "lucide-react";
import { Button } from "../ui/button";

// Front silhouette follows Apple's 78 × 163.4 mm enclosure dimensions.
export default function PhoneMockup({ videoSrc }: { videoSrc: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const respectMotion = () => {
      if (media.matches) video.current?.pause();
      else void video.current?.play().catch(() => {});
    };
    respectMotion();
    media.addEventListener("change", respectMotion);
    return () => media.removeEventListener("change", respectMotion);
  }, [videoSrc]);

  return (
    <figure className="flex w-full max-w-80 shrink-0 flex-col items-center gap-4 md:ml-auto md:w-72 lg:w-80">
      <div
        className="relative w-full max-w-80 rounded-4xl border border-border bg-gradient-to-br from-muted via-background to-muted-foreground p-1 shadow-2xl"
        style={{ aspectRatio: "78 / 163.4" }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -left-1 top-24 h-5 w-1 rounded-l-sm bg-muted-foreground"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-1 top-36 h-10 w-1 rounded-l-sm bg-muted-foreground"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-1 top-48 h-10 w-1 rounded-l-sm bg-muted-foreground"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-1 top-40 h-16 w-1 rounded-r-sm bg-muted-foreground"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-1 bottom-40 h-10 w-1 rounded-r-sm bg-muted-foreground"
        />
        <div className="relative h-full overflow-hidden rounded-4xl border-4 border-foreground bg-background">
          <video
            ref={video}
            className="h-full w-full object-contain"
            muted
            loop
            playsInline
            preload="metadata"
            aria-label="Démonstration d’ExtravertyAI sur un iPhone 17 Pro Max"
            onLoadedMetadata={() => setLoading(false)}
            onCanPlay={() => setLoading(false)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onError={() => {
              setFailed(true);
              setLoading(false);
              setPlaying(false);
            }}
            src={videoSrc}
          >
            Votre navigateur ne prend pas en charge cette vidéo.
          </video>
          {loading && (
            <div
              role="status"
              className="absolute inset-0 flex items-center justify-center bg-muted"
            >
              <Loader2
                aria-hidden
                className="size-6 animate-spin motion-reduce:animate-none"
              />
              <span className="sr-only">Chargement de la démonstration…</span>
            </div>
          )}
          {failed && (
            <div
              role="status"
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted p-6 text-center text-sm text-muted-foreground"
            >
              <VideoOff aria-hidden className="size-6" />
              La démonstration est momentanément indisponible.
            </div>
          )}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-3 flex h-7 w-24 -translate-x-1/2 items-center justify-end rounded-full bg-foreground px-2"
          >
            <span className="size-2 rounded-full bg-muted-foreground/40 ring-2 ring-background/10" />
          </div>
          <div
            aria-hidden
            className="pointer-events-none absolute bottom-2 left-1/2 h-1 w-24 -translate-x-1/2 rounded-full bg-foreground/70"
          />
        </div>
      </div>
      <figcaption className="flex flex-col items-center gap-2">
        <span className="text-xs text-muted-foreground">
          Démonstration · iPhone 17 Pro Max
        </span>
        {!failed && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              if (playing) video.current?.pause();
              else
                void video.current?.play().catch(() => {
                  setFailed(true);
                  setLoading(false);
                });
            }}
          >
            {playing ? (
              <Pause aria-hidden className="size-4" />
            ) : (
              <Play aria-hidden className="size-4" />
            )}
            {playing ? "Mettre en pause" : "Lire la démonstration"}
          </Button>
        )}
      </figcaption>
    </figure>
  );
}
