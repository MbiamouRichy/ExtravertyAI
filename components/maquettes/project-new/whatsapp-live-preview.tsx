"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import {
  BadgeCheck,
  CheckCheck,
  ChevronLeft,
  CornerDownRight,
  Mic,
  Phone,
  Plus,
  Video,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { EASE_OUT, SPRING } from "@/components/website/vitrine/motion";

import { LANGUAGE_OPTIONS, TONE_OPTIONS } from "./data";
import { PhoneFrame } from "@/components/phone-frame";
import {
  buildPreviewConversation,
  initialsOf,
  type PreviewInput,
  type PreviewMessage,
} from "./preview-script";

const SETTLE_MS = 550;

/**
 * Holds the last value that stayed unchanged for `delay` ms. While the user
 * types, the preview shows "écrit…" instead of rewriting bubbles per key.
 */
function useSettledValue<T>(value: T, delay: number): [T, boolean] {
  const key = JSON.stringify(value);
  const [settled, setSettled] = useState(() => ({ key, value }));

  useEffect(() => {
    if (key === settled.key) return;
    const timer = setTimeout(
      () => setSettled({ key, value: JSON.parse(key) as T }),
      delay,
    );
    return () => clearTimeout(timer);
  }, [key, settled.key, delay]);

  return [settled.value, key !== settled.key];
}

export interface WhatsAppLivePreviewProps {
  input: PreviewInput;
  connected: boolean;
  className?: string;
}

export function WhatsAppLivePreview({
  input,
  connected,
  className,
}: WhatsAppLivePreviewProps) {
  const [settled, typing] = useSettledValue(input, SETTLE_MS);
  const messages = useMemo(() => buildPreviewConversation(settled), [settled]);
  const business = settled.name.trim() || "Votre entreprise";
  const tone = TONE_OPTIONS.find((option) => option.value === input.tone);
  const language = LANGUAGE_OPTIONS.find(
    (option) => option.value === input.language,
  );

  return (
    <figure
      aria-label="Aperçu en direct : ce que vos clients verront sur WhatsApp"
      className={cn("flex w-full flex-col items-center gap-5", className)}
    >
      <div className="flex w-76 items-center justify-between font-mono text-[11px] text-muted-foreground">
        <span className="flex items-center gap-2 font-medium tracking-widest text-foreground uppercase">
          <span aria-hidden="true" className="relative flex size-1.5">
            <span className="absolute inline-flex size-full rounded-full bg-foreground opacity-60 motion-safe:animate-ping" />
            <span className="relative inline-flex size-1.5 rounded-full bg-foreground" />
          </span>
          Aperçu en direct
        </span>
        <span>Vue client</span>
      </div>

      <PhoneFrame>
        <ChatHeader business={business} typing={typing} />

        <div className="relative min-h-0 flex-1 overflow-hidden bg-muted/50 bg-[radial-gradient(color-mix(in_oklch,var(--foreground)_7%,transparent)_1px,transparent_1px)] bg-size-[14px_14px]">
          <ol
            aria-label="Conversation simulée"
            className="absolute inset-x-0 bottom-0 flex max-h-full flex-col gap-1.5 p-3 mask-[linear-gradient(to_bottom,transparent,black_2.5rem)]"
          >
            <li className="mx-auto mb-2 flex w-full max-w-56 flex-col items-center rounded-xl border bg-card px-3 py-3 text-center">
              <Avatar name={business} size="lg" />
              <p className="mt-2 flex max-w-full items-center gap-1 text-sm font-semibold">
                <span className="truncate">{business}</span>
                <BadgeCheck aria-hidden="true" className="size-3.5 shrink-0" />
              </p>
              <p className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
                Compte professionnel
              </p>
              <p
                className={cn(
                  "mt-1.5 line-clamp-3 text-[11px] leading-snug text-muted-foreground",
                  !settled.description.trim() && "italic",
                )}
              >
                {settled.description.trim() ||
                  "La description de votre activité apparaîtra ici."}
              </p>
            </li>
            <li className="mb-1 self-center rounded-md border bg-card px-2 py-0.5 font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
              Aujourd’hui
            </li>

            <AnimatePresence initial={false} mode="popLayout">
              {messages.map((message) => (
                <Bubble key={`${message.id}:${message.text}`} message={message} />
              ))}
              {typing && (
                <m.li
                  key="typing"
                  layout="position"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                  transition={SPRING}
                  className="flex w-fit items-center gap-1 self-start rounded-2xl rounded-bl-md border bg-card px-3 py-2.5"
                >
                  <span className="sr-only">L’agent rédige une réponse</span>
                  {[0, 1, 2].map((dot) => (
                    <m.span
                      key={dot}
                      aria-hidden="true"
                      className="size-1.5 rounded-full bg-muted-foreground"
                      animate={{ opacity: [0.35, 1, 0.35], y: [0, -2, 0] }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        delay: dot * 0.16,
                        ease: "easeInOut",
                      }}
                    />
                  ))}
                </m.li>
              )}
            </AnimatePresence>
          </ol>
        </div>

        <div
          aria-hidden="true"
          className="flex shrink-0 items-center gap-2 border-t bg-card px-2.5 pt-2 pb-4"
        >
          <Plus className="size-5 text-muted-foreground" />
          <span className="flex h-8 flex-1 items-center rounded-full border bg-background px-3 text-xs text-muted-foreground">
            Message
          </span>
          <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Mic className="size-4" />
          </span>
        </div>
      </PhoneFrame>

      <figcaption className="w-76">
        <dl className="grid grid-cols-2 overflow-hidden rounded-lg border bg-border font-mono text-[11px] gap-px">
          <PreviewFact label="Langue" value={language?.label ?? "—"} />
          <PreviewFact label="Ton" value={tone?.label ?? "—"} />
          <PreviewFact
            label="Sources"
            value={
              input.sourceLabels.length
                ? `${input.sourceLabels.length} document${input.sourceLabels.length > 1 ? "s" : ""}`
                : "Aucune"
            }
          />
          <PreviewFact
            label="WhatsApp"
            value={connected ? "Connecté" : "À connecter"}
            live={connected}
          />
        </dl>
      </figcaption>
    </figure>
  );
}

function ChatHeader({ business, typing }: { business: string; typing: boolean }) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b bg-card px-2.5 pt-1 pb-2.5">
      <ChevronLeft aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
      <Avatar name={business} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 text-sm leading-tight font-semibold">
          <span className="truncate">{business}</span>
          <BadgeCheck aria-hidden="true" className="size-3.5 shrink-0" />
        </p>
        <AnimatePresence mode="wait" initial={false}>
          <m.p
            key={typing ? "typing" : "idle"}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.18, ease: EASE_OUT }}
            className="truncate text-[11px] leading-tight text-muted-foreground"
          >
            {typing ? "écrit…" : "en ligne"}
          </m.p>
        </AnimatePresence>
      </div>
      <Video aria-hidden="true" className="size-4.5 shrink-0 text-muted-foreground" />
      <Phone aria-hidden="true" className="ml-2 size-4 shrink-0 text-muted-foreground" />
    </div>
  );
}

function Avatar({ name, size = "default" }: { name: string; size?: "default" | "lg" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-primary font-heading font-bold text-primary-foreground",
        size === "lg" ? "size-11 text-sm" : "size-8 text-[11px]",
      )}
    >
      {initialsOf(name)}
    </span>
  );
}

function Bubble({ message }: { message: PreviewMessage }) {
  const fromCustomer = message.from === "customer";

  return (
    <m.li
      layout="position"
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
      transition={SPRING}
      className={cn(
        "flex max-w-[84%] flex-col gap-1",
        fromCustomer ? "items-end self-end" : "items-start self-start",
      )}
    >
      <span
        className={cn(
          "rounded-2xl px-3 py-2 text-[13px] leading-snug",
          fromCustomer
            ? "rounded-br-md bg-primary text-primary-foreground"
            : "rounded-bl-md border bg-card",
        )}
      >
        <span className="sr-only">{fromCustomer ? "Client : " : "Agent : "}</span>
        <span className="text-pretty">{message.text}</span>
        <span
          className={cn(
            "mt-0.5 flex items-center justify-end gap-1 font-mono text-[10px]",
            fromCustomer ? "opacity-70" : "text-muted-foreground",
          )}
        >
          {message.time}
          {fromCustomer && <CheckCheck aria-hidden="true" className="size-3" />}
        </span>
      </span>
      {message.note && (
        <span className="flex items-center gap-1 rounded-md border border-dashed bg-background/80 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground backdrop-blur">
          <CornerDownRight aria-hidden="true" className="size-3 shrink-0" />
          <span className="sr-only">Note de l’aperçu : </span>
          {message.note}
        </span>
      )}
    </m.li>
  );
}

function PreviewFact({
  label,
  value,
  live = false,
}: {
  label: string;
  value: string;
  live?: boolean;
}) {
  return (
    <div className="min-w-0 bg-card px-3 py-2">
      <dt className="text-[10px] tracking-wider text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 flex items-center gap-1.5 truncate font-medium">
        {live && (
          <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-foreground" />
        )}
        <span className="truncate">{value}</span>
      </dd>
    </div>
  );
}
