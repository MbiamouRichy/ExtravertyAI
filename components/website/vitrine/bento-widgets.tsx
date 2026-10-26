"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentProps,
  type PointerEvent,
} from "react";
import { AnimatePresence, m, useInView } from "motion/react";
import { Clock3, Loader2, Pause, Play, RotateCcw, Sparkles, UserRoundCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";

import { EASE_OUT, SPRING } from "./motion";

/* -------------------------------------------------------------------------- */
/* Cell with a pointer-following light, tinted from the theme foreground       */
/* -------------------------------------------------------------------------- */

export function SpotlightCell({ className, children, ...props }: ComponentProps<"article">) {
  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
  };

  return (
    <article
      {...props}
      onPointerMove={onPointerMove}
      className={cn("group/cell relative isolate flex flex-col overflow-hidden bg-background", className)}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-500 group-hover/cell:opacity-100"
        style={{
          background:
            "radial-gradient(30rem circle at var(--spot-x, 50%) var(--spot-y, 50%), color-mix(in oklch, var(--foreground) 6%, transparent), transparent 60%)",
        }}
      />
      {children}
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/* Takeover: the project's Switch hands the conversation to a human            */
/* -------------------------------------------------------------------------- */

export function TakeoverWidget() {
  const [aiActive, setAiActive] = useState(true);
  const switchId = useId();

  return (
    <div className="mt-8 overflow-hidden rounded-lg border bg-card">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary font-heading text-[11px] font-bold">
            MK
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium leading-tight">Moussa K.</span>
            <span className="block font-mono text-[11px] leading-tight text-muted-foreground">
              {aiActive ? "Géré par l’IA" : "Géré par vous"}
            </span>
          </span>
        </span>
        <span className="flex items-center gap-2.5">
          <Label htmlFor={switchId} className="font-mono text-[11px] font-normal text-muted-foreground">
            Réponses IA
          </Label>
          <Switch id={switchId} checked={aiActive} onCheckedChange={setAiActive} />
        </span>
      </div>
      <ol aria-label="Aperçu de la conversation" className="flex min-h-56 flex-col justify-end gap-2 p-4 text-xs">
        <li className="max-w-[80%] self-start rounded-2xl rounded-bl-sm bg-muted px-3 py-2">
          Vous faites un prix si je prends 10 pièces ?
        </li>
        <li className="max-w-[80%] self-end rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-primary-foreground">
          Bonne question ! Je vérifie avec l’équipe et je reviens vers vous 🙏
        </li>
        <AnimatePresence initial={false}>
          {!aiActive && (
            <m.li
              key="system"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={SPRING}
              className="flex items-center gap-1.5 self-center rounded-full border bg-background px-3 py-1 font-mono text-[10px] text-muted-foreground"
            >
              <UserRoundCheck aria-hidden="true" className="size-3 text-foreground" />
              Vous avez repris la main · IA en pause
            </m.li>
          )}
          {!aiActive && (
            <m.li
              key="agent"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ ...SPRING, delay: 0.25 }}
              className="max-w-[80%] self-end rounded-2xl rounded-br-sm border bg-background px-3 py-2"
            >
              Bonjour Moussa, c’est Inès : je vous fais −15 % dès 10 pièces.
            </m.li>
          )}
        </AnimatePresence>
      </ol>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Voice note: playback fills the waveform and reveals the transcript          */
/* -------------------------------------------------------------------------- */

const WAVE = [4, 6, 9, 5, 7, 10, 8, 4, 6, 9, 7, 5, 8, 10, 6, 4, 7, 9, 5, 6, 8, 4, 6, 9, 7, 5, 3, 6, 8, 5, 4, 3];
const TRANSCRIPT = "Bonjour, vous livrez à Bafoussam ce week-end ? J’aimerais deux sacs noirs.".split(" ");
const VOICE_DURATION_S = 3.4;
// The filled waveform is revealed left to right over the muted one.
const CLIP_EMPTY = "inset(0 100% 0 0)";
const CLIP_FULL = "inset(0 0% 0 0)";

export function VoiceWidget() {
  const [status, setStatus] = useState<"idle" | "playing" | "done">("idle");
  const [run, setRun] = useState(0);

  const toggle = () => {
    if (status === "playing") {
      setStatus("done");
      return;
    }
    setRun((value) => value + 1);
    setStatus("playing");
  };

  return (
    <div className="mt-8 rounded-lg border bg-card p-4">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          size="icon"
          className="rounded-full"
          onClick={toggle}
          aria-label={status === "playing" ? "Arrêter la note vocale" : "Écouter la note vocale"}
        >
          {status === "playing" ? <Pause className="fill-current" /> : <Play className="fill-current" />}
        </Button>
        <div aria-hidden="true" className="relative h-10 flex-1">
          <Waveform className="text-foreground/20" />
          <m.div
            key={run}
            className="absolute inset-0"
            initial={{ clipPath: status === "done" ? CLIP_FULL : CLIP_EMPTY }}
            animate={{ clipPath: status === "idle" ? CLIP_EMPTY : CLIP_FULL }}
            transition={
              status === "playing" ? { duration: VOICE_DURATION_S, ease: "linear" } : { duration: 0.2 }
            }
            onAnimationComplete={() => {
              if (status === "playing") setStatus("done");
            }}
          >
            <Waveform className="text-foreground" />
          </m.div>
        </div>
        <span className="font-mono text-[11px] text-muted-foreground">0:07</span>
      </div>

      <div className="mt-4 min-h-14 border-t pt-3">
        <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <Sparkles aria-hidden="true" className="size-3" />
          Transcription
        </p>
        {status === "idle" ? (
          <p className="mt-1.5 text-xs text-muted-foreground">Lancez la note vocale pour voir la transcription.</p>
        ) : (
          <p key={run} className="mt-1.5 text-xs leading-relaxed">
            {TRANSCRIPT.map((word, index) => (
              <m.span
                key={`${word}-${index}`}
                initial={{ opacity: status === "done" ? 1 : 0.12 }}
                animate={{ opacity: 1 }}
                transition={{
                  duration: 0.2,
                  delay: status === "playing" ? (index / TRANSCRIPT.length) * VOICE_DURATION_S : 0,
                }}
              >
                {word}{" "}
              </m.span>
            ))}
          </p>
        )}
      </div>
    </div>
  );
}

function Waveform({ className }: { className?: string }) {
  return (
    <span className={cn("absolute inset-0 flex items-center gap-0.5", className)}>
      {WAVE.map((height, index) => (
        <span
          key={index}
          className="min-w-0.5 flex-1 rounded-full bg-current"
          style={{ height: `${height * 10}%` }}
        />
      ))}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Summary: 84 messages become three lines                                     */
/* -------------------------------------------------------------------------- */

const SUMMARY = [
  "Cliente fidèle, commande environ trois fois par mois.",
  "Souhaite une livraison groupée de 12 pièces à Douala.",
  "À faire : envoyer un devis avec remise volume avant vendredi.",
];

export function SummaryWidget() {
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const summarize = () => {
    setStatus("loading");
    timer.current = setTimeout(() => setStatus("done"), 1100);
  };

  return (
    <div className="mt-8 flex flex-1 flex-col rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-2 font-mono text-[11px] text-muted-foreground">
        <span>Fatou N. · 84 messages</span>
        <span>3 jours</span>
      </div>
      <div aria-live="polite" className="mt-4 min-h-24 flex-1">
        {status === "idle" && (
          <div aria-hidden="true" className="space-y-2">
            {["w-full", "w-11/12", "w-4/5", "w-full", "w-3/5"].map((width, index) => (
              <div key={index} className={cn("h-1.5 rounded-full bg-muted", width)} />
            ))}
          </div>
        )}
        {status === "loading" && (
          <div className="skeleton-shimmer space-y-2.5">
            <span className="sr-only">Résumé en cours</span>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        )}
        {status === "done" && (
          <ul className="space-y-2 text-xs">
            {SUMMARY.map((line, index) => (
              <m.li
                key={line}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: EASE_OUT, delay: index * 0.12 }}
                className="flex gap-2"
              >
                <span aria-hidden="true" className="mt-1.5 size-1 shrink-0 rounded-full bg-foreground" />
                {line}
              </m.li>
            ))}
          </ul>
        )}
      </div>
      <div className="mt-4 flex items-center gap-2">
        {status === "done" ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => setStatus("idle")}>
            <RotateCcw data-icon="inline-start" />
            Recommencer
          </Button>
        ) : (
          <Button type="button" size="sm" onClick={summarize} disabled={status === "loading"}>
            {status === "loading" ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : (
              <Sparkles data-icon="inline-start" />
            )}
            {status === "loading" ? "Résumé en cours…" : "Résumer la conversation"}
          </Button>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Instinct: lead tags land on the inbox as it scrolls into view               */
/* -------------------------------------------------------------------------- */

const LEADS: readonly { name: string; preview: string; tag: "interesting" | "follow-up" | null }[] = [
  { name: "Moussa K.", preview: "Je prends les deux si livré demain", tag: "interesting" },
  { name: "Aminata D.", preview: "Je vous redis pour samedi", tag: "follow-up" },
  { name: "Paul E.", preview: "Merci, bonne journée !", tag: null },
  { name: "Inès B.", preview: "Vous avez la taille au-dessus ?", tag: "interesting" },
];

export function InstinctWidget() {
  const ref = useRef<HTMLUListElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });

  return (
    <ul ref={ref} className="mt-8 divide-y rounded-lg border bg-card">
      {LEADS.map((lead, index) => (
        <li
          key={lead.name}
          className="flex items-start gap-3 px-3 py-2.5 transition-colors hover:bg-muted/50"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary font-heading text-[10px] font-bold">
            {lead.name.slice(0, 1)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex min-h-5 items-center justify-between gap-2">
              <span className="truncate text-xs font-medium">{lead.name}</span>
              {lead.tag && <LeadTag tag={lead.tag} show={inView} delay={0.25 + index * 0.18} />}
            </span>
            <span className="block truncate font-mono text-[11px] text-muted-foreground">{lead.preview}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function LeadTag({ tag, show, delay }: { tag: "interesting" | "follow-up"; show: boolean; delay: number }) {
  const interesting = tag === "interesting";
  return (
    <m.span
      initial={false}
      animate={show ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.6 }}
      transition={{ ...SPRING, delay }}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]",
        interesting && "border-primary bg-primary text-primary-foreground",
      )}
    >
      {interesting ? (
        <Sparkles aria-hidden="true" className="size-3" />
      ) : (
        <Clock3 aria-hidden="true" className="size-3" />
      )}
      {interesting ? "Intéressant" : "À suivre"}
    </m.span>
  );
}
