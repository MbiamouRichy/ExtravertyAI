"use client";
import { useEffect, useRef, useState } from "react";
import { Loader2, Pause, Play, RotateCcw, VideoOff } from "lucide-react";
import { Button } from "../ui/button";

// iPhone 17 Pro Max proportions: 78 × 163.4 mm enclosure, 440 × 956 pt display.
// Percent paddings/radii resolve against the width, so the device scales as one
// piece. Glass, bezel and Dynamic Island are black in both themes, as on the
// real hardware; the metal frame follows the theme foreground.
const ENCLOSURE_RADIUS = "13% / 6.2%";
const SCREEN_RADIUS = "10.8% / 5%";
const BUTTONS = [
  { side: "left", top: "17.5%", height: "4.2%", label: "action" },
  { side: "left", top: "24.5%", height: "7.5%", label: "volume-up" },
  { side: "left", top: "33.5%", height: "7.5%", label: "volume-down" },
  { side: "right", top: "26.5%", height: "11.5%", label: "side" },
  { side: "right", top: "56%", height: "6.5%", label: "camera-control" },
] as const;

export default function PhoneMockup({ videoSrc }: { videoSrc: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    // A cached video can emit its readiness events before React hydrates.
    const sync = () => {
      if (element.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        setLoading(false);
        setFailed(false);
      }
      setPlaying(!element.paused);
    };
    const respectMotion = () => {
      if (media.matches) element.pause();
      else void element.play().catch(sync);
    };
    sync();
    respectMotion();
    const poll = window.setInterval(sync, 1000);
    const timeout = window.setTimeout(() => {
      if (element.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        setLoading(false);
        setFailed(true);
      }
    }, 20000);
    media.addEventListener("change", respectMotion);
    return () => {
      window.clearInterval(poll);
      window.clearTimeout(timeout);
      media.removeEventListener("change", respectMotion);
    };
  }, [videoSrc]);

  return (
    <figure className="flex w-full max-w-80 shrink-0 flex-col items-center gap-3 md:ml-auto md:w-72 lg:w-80">
      <div
        className="relative w-full drop-shadow-2xl"
        style={{ aspectRatio: "78 / 163.4" }}
      >
        {BUTTONS.map(({ side, top, height, label }) => (
          <div
            key={label}
            aria-hidden
            className={`pointer-events-none absolute w-[3px] bg-linear-to-b from-foreground/45 via-foreground/25 to-foreground/45 ${
              side === "left"
                ? "-left-[2px] rounded-l-sm"
                : "-right-[2px] rounded-r-sm"
            } ${label === "camera-control" ? "opacity-70" : ""}`}
            style={{ top, height }}
          />
        ))}
        {/* Metal frame */}
        <div
          className="relative h-full bg-linear-to-br from-foreground/50 via-foreground/20 to-foreground/45 p-[1.3%] ring-1 ring-foreground/15"
          style={{ borderRadius: ENCLOSURE_RADIUS }}
        >
          {/* Black glass with thin, even bezels */}
          <div
            className="relative h-full bg-black p-[2.6%] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06)]"
            style={{ borderRadius: "11.9% / 5.6%" }}
          >
            <div
              className="relative h-full overflow-hidden bg-black"
              style={{ borderRadius: SCREEN_RADIUS }}
            >
              <video
                ref={video}
                className="h-full w-full object-cover"
                muted
                loop
                playsInline
                preload="auto"
                aria-label="Démonstration d’ExtravertyAI sur un iPhone 17 Pro Max"
                onLoadedData={() => {
                  setLoading(false);
                  setFailed(false);
                }}
                onCanPlay={() => setLoading(false)}
                onPlaying={() => {
                  setPlaying(true);
                  setLoading(false);
                  setFailed(false);
                }}
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
                  <span className="sr-only">
                    Chargement de la démonstration…
                  </span>
                </div>
              )}
              {failed && (
                <div
                  role="status"
                  className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted p-6 text-center text-sm text-muted-foreground"
                >
                  <VideoOff aria-hidden className="size-6" />
                  La vidéo n’a pas pu se charger.
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFailed(false);
                      setLoading(false);
                      video.current?.load();
                      void video.current?.play().catch(() => {
                        setFailed(true);
                      });
                    }}
                  >
                    <RotateCcw aria-hidden />
                    Réessayer
                  </Button>
                </div>
              )}
              {/* Dynamic Island: 126 × 37 pt, 11 pt from the top of a 440 pt wide display */}
              <div
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-[1.15%] flex w-[28.6%] -translate-x-1/2 items-center justify-end rounded-full bg-black pr-[3.5%]"
                style={{ aspectRatio: "126 / 37" }}
              >
                <span className="aspect-square w-[14%] rounded-full bg-[radial-gradient(circle_at_35%_35%,rgb(80_90_120/0.9),rgb(10_10_20)_60%)]" />
              </div>
            </div>
          </div>
        </div>
      </div>
      {!loading && !failed && (
        <figcaption>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => {
              if (playing) video.current?.pause();
              else void video.current?.play().catch(() => setPlaying(false));
            }}
          >
            {playing ? <Pause aria-hidden /> : <Play aria-hidden />}
            {playing ? "Mettre la démo en pause" : "Lire la démo"}
          </Button>
        </figcaption>
      )}
    </figure>
  );
}
