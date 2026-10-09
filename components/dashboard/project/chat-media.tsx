"use client";
import { useState } from "react";
import { AudioPlayer } from "./audio-player";
import { FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ChatMedia({
  type,
  url,
  caption,
}: {
  type: string;
  url: string;
  caption: string;
}) {
  const [loading, setLoading] = useState(type === "IMAGE");
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);
  const src = version ? `${url}?retry=${version}` : url;
  return (
    <div className="max-w-full space-y-2" aria-busy={loading && !failed}>
      {loading && !failed && (
        <p role="status" className="text-sm text-muted-foreground">
          Chargement de l’image…
        </p>
      )}
      {failed ? (
        <div
          role="status"
          className="space-y-2 rounded-lg border bg-muted p-3 text-sm text-muted-foreground"
        >
          <p>Média indisponible, expiré ou supérieur à 4 Mo.</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setFailed(false);
              setLoading(type === "IMAGE");
              setVersion((v) => v + 1);
            }}
          >
            Réessayer
          </Button>
        </div>
      ) : type === "IMAGE" ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Ouvrir l’image en taille réelle"
          className="block rounded-lg focus-visible:outline-2 focus-visible:outline-ring"
        >
          {/* Authenticated media must not pass through the public image optimizer. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={src}
            src={src}
            alt={caption || "Image partagée dans la conversation"}
            loading="lazy"
            onLoad={() => setLoading(false)}
            onError={() => setFailed(true)}
            className="max-h-80 max-w-full rounded-lg object-contain"
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
          className="max-h-80 max-w-full rounded-xl"
        />
      ) : type === "DOCUMENT" ? (
        <Button
          asChild
          variant="outline"
          className="h-auto max-w-full justify-start gap-3 whitespace-normal py-3"
        >
          <a href={url} download>
            <FileText aria-hidden="true" className="size-5 shrink-0" />
            <span>Télécharger le document</span>
            <Download aria-hidden="true" className="size-4 shrink-0" />
          </a>
        </Button>
      ) : (
        <AudioPlayer key={src} src={src} onError={() => setFailed(true)} />
      )}
      {caption && (
        <p dir="auto" className="whitespace-pre-wrap wrap-anywhere">
          {caption}
        </p>
      )}
    </div>
  );
}
