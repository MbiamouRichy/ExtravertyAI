"use client";

import { AnimatePresence, m } from "motion/react";
import {
  BadgeCheck,
  CheckCheck,
  ChevronLeft,
  CornerDownRight,
  Phone,
  Plus,
  SendHorizontal,
  Video,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { SPRING } from "@/components/website/vitrine/motion";
import { PhoneFrame } from "@/components/maquettes/project-new/phone-frame";

import { needLabel, type ContactFormValues } from "./data";

type Part = { text: string; placeholder?: boolean };

export function draftLines(values: ContactFormValues): Part[][] {
  const name = values.name.trim();
  const business = values.business.trim();
  const message = values.message.trim();
  return [
    [{ text: "Bonjour ExtravertyAI !" }],
    [
      { text: "Je m’appelle " },
      name ? { text: name } : { text: "votre nom", placeholder: true },
      { text: ", de " },
      business ? { text: business } : { text: "votre activité", placeholder: true },
      { text: "." },
    ],
    [{ text: `Mon besoin : ${needLabel(values.need)}.` }],
    [message ? { text: message } : { text: "votre message…", placeholder: true }],
  ];
}

export function Draft({ lines, className }: { lines: Part[][]; className?: string }) {
  return (
    <span className={cn("block whitespace-pre-wrap break-words", className)}>
      {lines.map((line, index) => (
        <span key={index} className="block">
          {line.map((part, partIndex) => (
            <span
              key={partIndex}
              className={cn(
                part.placeholder &&
                  "rounded-sm bg-current/10 px-0.5 italic opacity-60",
              )}
            >
              {part.text}
            </span>
          ))}
        </span>
      ))}
    </span>
  );
}

interface MessagePreviewProps {
  values: ContactFormValues;
  /** Last message handed to WhatsApp, shown as sent in the thread. */
  sent: ContactFormValues | null;
}

/** What WhatsApp will show: the prefilled draft sits in the composer, ready to send. */
export function MessagePreview({ values, sent }: MessagePreviewProps) {
  return (
    <figure
      aria-label="Aperçu du message pré-rempli dans WhatsApp"
      className="flex w-full flex-col items-center gap-5"
    >
      <div className="flex w-76 items-center justify-between font-mono text-[11px] text-muted-foreground">
        <span className="flex items-center gap-2 font-medium tracking-widest text-foreground uppercase">
          <span aria-hidden="true" className="relative flex size-1.5">
            <span className="absolute inline-flex size-full rounded-full bg-foreground opacity-60 motion-safe:animate-ping" />
            <span className="relative inline-flex size-1.5 rounded-full bg-foreground" />
          </span>
          Aperçu exact
        </span>
        <span>Votre WhatsApp</span>
      </div>

      <PhoneFrame>
        <div className="flex shrink-0 items-center gap-2 border-b bg-card px-2.5 pt-1 pb-2.5">
          <ChevronLeft aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
          <span
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary font-heading text-[11px] font-bold text-primary-foreground"
          >
            EA
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 text-sm leading-tight font-semibold">
              <span className="truncate">ExtravertyAI</span>
              <BadgeCheck aria-hidden="true" className="size-3.5 shrink-0" />
            </p>
            <p className="truncate text-[11px] leading-tight text-muted-foreground">
              Compte professionnel
            </p>
          </div>
          <Video aria-hidden="true" className="size-4.5 shrink-0 text-muted-foreground" />
          <Phone aria-hidden="true" className="ml-2 size-4 shrink-0 text-muted-foreground" />
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden bg-muted/50 bg-[radial-gradient(color-mix(in_oklch,var(--foreground)_7%,transparent)_1px,transparent_1px)] bg-size-[14px_14px]">
          <ol
            aria-label="Conversation"
            className="absolute inset-x-0 bottom-0 flex max-h-full flex-col gap-1.5 p-3 mask-[linear-gradient(to_bottom,transparent,black_2.5rem)]"
          >
            <li className="mx-auto mb-2 flex w-full max-w-56 flex-col items-center rounded-xl border bg-card px-3 py-3 text-center">
              <span
                aria-hidden="true"
                className="flex size-11 items-center justify-center rounded-full bg-primary font-heading text-sm font-bold text-primary-foreground"
              >
                EA
              </span>
              <p className="mt-2 text-sm font-semibold">ExtravertyAI</p>
              <p className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                Compte professionnel
              </p>
              <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
                Service client WhatsApp, automatisé par l’IA.
              </p>
            </li>
            <li className="mb-1 self-center rounded-md border bg-card px-2 py-0.5 font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
              Aujourd’hui
            </li>

            <AnimatePresence initial={false}>
              {sent && (
                <m.li
                  key={JSON.stringify(sent)}
                  layout="position"
                  initial={{ opacity: 0, y: 24, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={SPRING}
                  className="flex max-w-[86%] flex-col items-end gap-1 self-end"
                >
                  <span className="rounded-2xl rounded-br-md bg-primary px-3 py-2 text-[13px] leading-snug text-primary-foreground">
                    <span className="sr-only">Votre message : </span>
                    <Draft lines={draftLines(sent)} />
                    <span className="mt-0.5 flex items-center justify-end gap-1 font-mono text-[10px] opacity-70">
                      à l’instant
                      <CheckCheck aria-hidden="true" className="size-3" />
                    </span>
                  </span>
                  <span className="flex items-center gap-1 rounded-md border border-dashed bg-background/80 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground backdrop-blur">
                    <CornerDownRight aria-hidden="true" className="size-3 shrink-0" />
                    Ouvert dans WhatsApp : à vous d’envoyer
                  </span>
                </m.li>
              )}
            </AnimatePresence>
          </ol>
        </div>

        <div className="flex shrink-0 items-end gap-2 border-t bg-card px-2.5 pt-2 pb-4">
          <Plus aria-hidden="true" className="mb-1.5 size-5 shrink-0 text-muted-foreground" />
          <div className="relative max-h-36 min-h-8 flex-1 overflow-hidden rounded-2xl border bg-background px-3 py-1.5 text-xs leading-snug mask-[linear-gradient(to_top,black_80%,transparent)]">
            <span className="sr-only">Texte pré-rempli : </span>
            <Draft lines={draftLines(values)} />
          </div>
          <span
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
          >
            <SendHorizontal className="size-4" />
          </span>
        </div>
      </PhoneFrame>

      <figcaption className="w-76 text-center font-mono text-[11px] leading-relaxed text-muted-foreground">
        WhatsApp s’ouvre avec ce texte dans le champ de saisie. Vous gardez la main :
        rien ne part sans votre envoi.
      </figcaption>
    </figure>
  );
}

