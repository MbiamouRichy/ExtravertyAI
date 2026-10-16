"use client";
import { useState, type ReactNode } from "react";
import { Download, FileText, ImageOff, RefreshCw } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AiInsight, AudioPlayer, type AudioTranscript } from "./audio-player";

/**
 * Bulle de média façon messagerie : le média, sa légende, l’analyse IA et
 * l’heure sont regroupés dans une même carte, alignée selon l’expéditeur.
 */
export function ChatMedia({
  type,
  url,
  caption,
  transcript,
  analysis,
  footer,
  outgoing = false,
}: {
  type: string;
  url: string;
  caption: string;
  /** Transcription d’un message vocal. */
  transcript?: AudioTranscript | null;
  /** Analyse IA d’une image. */
  analysis?: AudioTranscript | null;
  /** Heure et statut d’envoi, affichés dans la carte. */
  footer?: ReactNode;
  outgoing?: boolean;
}) {
  const [loading, setLoading] = useState(type === "IMAGE");
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);
  const src = version ? `${url}?retry=${version}` : url;

  if (type === "AUDIO" && !failed) {
    return (
      <AudioPlayer
        key={src}
        src={src}
        transcript={transcript}
        footer={footer}
        className={outgoing ? "rounded-bl-2xl rounded-br-md" : undefined}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      aria-busy={loading && !failed}
      className={cn(
        "w-72 max-w-full space-y-1.5 overflow-hidden rounded-2xl border p-1.5 shadow-xs",
        outgoing
          ? "rounded-br-md border-transparent bg-primary text-primary-foreground"
          : "rounded-bl-md bg-background",
      )}
    >
      {failed ? (
        <div
          role="status"
          className="flex flex-col items-center gap-2 rounded-xl bg-muted px-4 py-6 text-center text-xs text-muted-foreground"
        >
          <ImageOff aria-hidden="true" className="size-5" />
          <p>Média indisponible, expiré ou supérieur à 4 Mo.</p>
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={() => {
              setFailed(false);
              setLoading(type === "IMAGE");
              setVersion((value) => value + 1);
            }}
          >
            <RefreshCw data-icon="inline-start" />
            Réessayer
          </Button>
        </div>
      ) : type === "IMAGE" ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Ouvrir l’image en taille réelle"
          className="relative block overflow-hidden rounded-xl bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {loading && (
            <span role="status" className="flex aspect-4/3 w-full animate-pulse items-center justify-center motion-reduce:animate-none">
              <span className="sr-only">Chargement de l’image…</span>
            </span>
          )}
          {/* Authenticated media must not pass through the public image optimizer. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={src}
            src={src}
            alt={caption || "Image partagée dans la conversation"}
            loading="lazy"
            onLoad={() => setLoading(false)}
            onError={() => setFailed(true)}
            className={cn(
              "max-h-80 w-full object-cover transition-opacity duration-300",
              loading ? "absolute inset-0 opacity-0" : "opacity-100",
            )}
          />
        </a>
      ) : type === "VIDEO" ? (
        <video
          src={src}
          controls
          preload="metadata"
          playsInline
          aria-label="Vidéo de la conversation"
          onError={() => setFailed(true)}
          className="max-h-80 w-full rounded-xl bg-muted"
        />
      ) : (
        <a
          href={url}
          download
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-3 text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
            outgoing ? "bg-primary-foreground/10 hover:bg-primary-foreground/15" : "bg-muted hover:bg-muted/70",
          )}
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background text-foreground">
            <FileText aria-hidden="true" className="size-4" />
          </span>
          <span className="min-w-0 flex-1 font-medium">Document</span>
          <Download aria-hidden="true" className="size-4 shrink-0 opacity-70" />
          <span className="sr-only">Télécharger le document</span>
        </a>
      )}

      {caption && (
        <p dir="auto" className="whitespace-pre-wrap px-2 pt-0.5 text-sm leading-relaxed wrap-anywhere">
          {caption}
        </p>
      )}
      {type === "IMAGE" && analysis && <AiInsight insight={analysis} label="Analyse IA de l’image" />}
      {footer && <div className="px-2 pb-0.5">{footer}</div>}
    </div>
  );
}
