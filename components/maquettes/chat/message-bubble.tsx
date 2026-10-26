"use client";

import { useState } from "react";
import {
  Check,
  CheckCheck,
  Clock3,
  Image as ImageIcon,
  Lock,
  Pause,
  Play,
  Sparkles,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

import type { Delivery, Message } from "./data";

const deliveryLabel: Record<Delivery, string> = {
  sending: "Envoi en cours",
  sent: "Envoyé",
  delivered: "Distribué",
  read: "Lu",
};

function DeliveryIcon({ delivery }: { delivery: Delivery }) {
  const Icon =
    delivery === "sending" ? Clock3 : delivery === "sent" ? Check : CheckCheck;
  return (
    <span title={deliveryLabel[delivery]} className="inline-flex">
      <Icon
        aria-hidden="true"
        className={cn("size-3.5", delivery === "read" ? "opacity-100" : "opacity-60")}
      />
      <span className="sr-only">{deliveryLabel[delivery]}</span>
    </span>
  );
}

const bars = [4, 7, 5, 9, 6, 10, 5, 8, 4, 7, 9, 6, 4, 8, 5, 7, 3, 6, 8, 5, 4, 6, 3];

function VoiceNote({ message, outgoing }: { message: Message; outgoing: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [showTranscript, setShowTranscript] = useState(true);

  return (
    <div className="w-64 max-w-full space-y-2">
      <div className="flex items-center gap-2.5">
        <Button
          size="icon-sm"
          variant={outgoing ? "secondary" : "default"}
          className="rounded-full"
          aria-label={playing ? "Mettre en pause" : "Écouter la note vocale"}
          aria-pressed={playing}
          onClick={() => setPlaying((value) => !value)}
        >
          {playing ? <Pause /> : <Play />}
        </Button>
        <span aria-hidden="true" className="flex h-7 flex-1 items-center gap-0.5">
          {bars.map((height, index) => (
            <span
              key={index}
              className={cn(
                "w-1 rounded-full bg-current transition-opacity",
                playing && index < bars.length / 2 ? "opacity-100" : "opacity-35",
              )}
              style={{ height: `${height * 10}%` }}
            />
          ))}
        </span>
        <span className="font-mono text-[11px] tabular-nums opacity-70">
          {message.duration}
        </span>
      </div>
      <div
        className={cn(
          "rounded-lg px-2.5 py-2 text-xs",
          outgoing ? "bg-primary-foreground/10" : "bg-muted",
        )}
      >
        <button
          type="button"
          onClick={() => setShowTranscript((value) => !value)}
          aria-expanded={showTranscript}
          className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider opacity-70 outline-none hover:opacity-100 focus-visible:underline"
        >
          <Sparkles aria-hidden="true" className="size-3" />
          Transcription IA
        </button>
        {showTranscript && <p className="mt-1 leading-relaxed">{message.text}</p>}
      </div>
    </div>
  );
}

export function MessageBubble({
  message,
  grouped,
}: {
  message: Message;
  grouped: boolean;
}) {
  if (message.author === "system") {
    return (
      <li className="my-3 flex justify-center">
        <p className="flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-center text-[11px] text-muted-foreground">
          <Sparkles aria-hidden="true" className="size-3" />
          {message.text}
          <span className="tabular-nums">· {message.time}</span>
        </p>
      </li>
    );
  }

  const outgoing = message.author !== "contact";
  const note = message.author === "note";
  const authorLabel =
    message.author === "ai"
      ? "Assistant IA"
      : message.author === "agent"
        ? "Vous"
        : note
          ? "Note interne"
          : "Contact";

  return (
    <li
      className={cn(
        "flex flex-col motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-200",
        outgoing ? "items-end" : "items-start",
        grouped ? "mt-0.5" : "mt-3",
      )}
    >
      {!grouped && outgoing && (
        <span className="mb-1 flex items-center gap-1 px-1 text-[11px] text-muted-foreground">
          {message.author === "ai" && <Sparkles aria-hidden="true" className="size-3" />}
          {note && <Lock aria-hidden="true" className="size-3" />}
          {authorLabel}
        </span>
      )}
      <div
        className={cn(
          "group relative max-w-[min(85%,34rem)] px-3.5 py-2 text-sm leading-relaxed",
          "rounded-2xl",
          !outgoing && "rounded-bl-md border bg-background",
          message.author === "ai" && "rounded-br-md bg-secondary text-secondary-foreground",
          message.author === "agent" && "rounded-br-md bg-primary text-primary-foreground",
          note && "rounded-br-md border border-dashed border-foreground/30 bg-muted/60",
        )}
      >
        <span className="sr-only">{authorLabel}, {message.time} : </span>
        {message.kind === "voice" ? (
          <VoiceNote message={message} outgoing={message.author === "agent"} />
        ) : message.kind === "image" ? (
          <figure className="-mx-1.5 -mt-0.5 space-y-1.5">
            <div
              role="img"
              aria-label={message.text}
              className="flex aspect-4/3 w-56 max-w-full items-center justify-center rounded-xl bg-[repeating-linear-gradient(45deg,var(--muted),var(--muted)_8px,var(--background)_8px,var(--background)_16px)]"
            >
              <ImageIcon aria-hidden="true" className="size-6 text-muted-foreground" />
            </div>
            <figcaption className="px-1.5 text-xs text-muted-foreground">
              {message.text}
            </figcaption>
          </figure>
        ) : (
          <p className="whitespace-pre-wrap wrap-break-word">{message.text}</p>
        )}
        <span
          aria-hidden={!message.delivery}
          className={cn(
            "mt-0.5 flex items-center justify-end gap-1 text-[10px] tabular-nums",
            message.author === "agent" ? "text-primary-foreground/70" : "text-muted-foreground",
          )}
        >
          {message.time}
          {message.delivery && !note && <DeliveryIcon delivery={message.delivery} />}
        </span>
      </div>
    </li>
  );
}
