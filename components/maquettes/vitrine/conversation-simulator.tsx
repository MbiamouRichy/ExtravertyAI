"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import {
  CheckCheck,
  Mic,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  UserRoundCheck,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

import { SCENARIOS, type Scenario, type SimMessage, type TraceStep } from "./data";
import { EASE_OUT, SPRING, useAutoplay } from "./motion";

const HOLD_AFTER_END_MS = 4800;
const VOICE_BARS = [3, 5, 8, 6, 9, 4, 7, 10, 6, 8, 5, 9, 7, 4, 6, 8, 5, 3, 6, 4, 7, 5, 3, 2];

export function ConversationSimulator() {
  const [scenarioIndex, setScenarioIndex] = useState(0);
  // The first client message is visible from the very first paint.
  const [cursor, setCursor] = useState(1);
  const [paused, setPaused] = useState(false);
  const { ref, canPlay, reduce } = useAutoplay<HTMLDivElement>(0.35);

  const scenario = SCENARIOS[scenarioIndex];
  const total = scenario.beats.length;
  const revealed = reduce ? total : Math.min(cursor, total);
  const running = canPlay && !paused;

  useEffect(() => {
    if (!running) return;
    if (cursor >= total) {
      const timer = setTimeout(() => {
        setScenarioIndex((index) => (index + 1) % SCENARIOS.length);
        setCursor(1);
      }, HOLD_AFTER_END_MS);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => setCursor((value) => value + 1), scenario.beats[cursor].delay);
    return () => clearTimeout(timer);
  }, [running, cursor, total, scenario]);

  const shown = scenario.beats.slice(0, revealed);
  const messages = shown.flatMap((beat) => (beat.kind === "message" ? [beat.message] : []));
  const steps = shown.flatMap((beat) => (beat.kind === "trace" ? [beat.step] : []));
  const last = shown.at(-1);
  const typing = last?.kind === "typing" ? last.who : null;
  const finished = revealed >= total;
  const handedOver = messages.some((message) => message.speaker === "system");

  const selectScenario = (index: number) => {
    setScenarioIndex(index);
    setCursor(1);
  };

  const replay = () => {
    setCursor(1);
    setPaused(false);
  };

  return (
    <div
      ref={ref}
      id="demo"
      role="region"
      aria-label="Démonstration : une conversation WhatsApp gérée par ExtravertyAI"
      className="scroll-mt-24"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div
          role="group"
          aria-label="Choisir un scénario"
          className="flex min-w-0 flex-1 rounded-lg border bg-background/80 p-0.5 backdrop-blur sm:flex-none"
        >
          {SCENARIOS.map((item, index) => {
            const selected = index === scenarioIndex;
            return (
              <Button
                key={item.id}
                type="button"
                size="sm"
                variant="ghost"
                aria-pressed={selected}
                onClick={() => selectScenario(index)}
                className={cn(
                  "relative min-w-0 flex-1 px-2 text-xs text-muted-foreground hover:bg-transparent sm:flex-none sm:px-2.5 sm:text-sm",
                  selected && "text-foreground",
                )}
              >
                {selected && (
                  <m.span
                    layoutId="vitrine-scenario-pill"
                    transition={SPRING}
                    aria-hidden="true"
                    className="absolute inset-0 rounded-[inherit] border bg-muted shadow-xs"
                  />
                )}
                <span className="relative">{item.label}</span>
              </Button>
            );
          })}
        </div>
        <div className="flex items-center gap-1">
          {!reduce && (
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              onClick={() => setPaused((value) => !value)}
              aria-label={paused ? "Reprendre la démonstration" : "Mettre la démonstration en pause"}
            >
              {paused ? <Play /> : <Pause />}
            </Button>
          )}
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            onClick={replay}
            aria-label="Rejouer la conversation"
            className="hidden sm:inline-flex"
          >
            <RotateCcw />
          </Button>
        </div>
      </div>

      <div className="relative">
        <div
          aria-hidden="true"
          className="absolute -inset-8 -z-10 bg-[radial-gradient(ellipse_at_center,color-mix(in_oklch,var(--foreground)_9%,transparent),transparent_70%)] blur-2xl"
        />
        <div className="grid overflow-hidden rounded-xl border bg-card shadow-2xl shadow-foreground/10 md:grid-cols-[minmax(0,1fr)_16.5rem]">
          <Thread
            scenario={scenario}
            messages={messages}
            typing={typing}
            handedOver={handedOver}
          />
          <TracePanel
            key={scenario.id}
            scenario={scenario}
            steps={steps}
            finished={finished}
          />
        </div>
      </div>
    </div>
  );
}

interface ThreadProps {
  scenario: Scenario;
  messages: SimMessage[];
  typing: "ai" | "agent" | null;
  handedOver: boolean;
}

function Thread({ scenario, messages, typing, handedOver }: ThreadProps) {
  const agent = scenario.agentName ?? "Équipe";

  return (
    <div className="flex min-w-0 flex-col">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary font-heading text-xs font-bold">
            {scenario.contact.initials}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium leading-tight">{scenario.contact.name}</p>
            <p className="truncate font-mono text-[11px] leading-tight text-muted-foreground">
              {typing ? "écrit…" : scenario.contact.business}
            </p>
          </div>
        </div>
        <AnimatePresence mode="popLayout" initial={false}>
          <m.span
            key={handedOver ? "human" : "ai"}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px]",
              handedOver ? "bg-background" : "border-transparent bg-primary text-primary-foreground",
            )}
          >
            <span className="relative flex size-1.5">
              {!handedOver && (
                <span className="absolute inline-flex size-full rounded-full bg-current opacity-60 motion-safe:animate-ping" />
              )}
              <span className="relative inline-flex size-1.5 rounded-full bg-current" />
            </span>
            {handedOver ? `${agent} · humain` : "IA active"}
          </m.span>
        </AnimatePresence>
      </div>

      <div className="relative h-96 overflow-hidden sm:h-104">
        <ol
          aria-label="Messages"
          className="absolute inset-x-0 bottom-0 flex flex-col gap-2.5 p-4 mask-[linear-gradient(to_bottom,transparent,black_3rem)]"
        >
          <li className="mb-1 self-center rounded-full border bg-background px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Aujourd’hui
          </li>
          <AnimatePresence initial={false}>
            {messages.map((message) => (
              <MessageBubble
                key={`${scenario.id}-${message.id}`}
                message={message}
                agent={agent}
              />
            ))}
            {typing && (
              <m.li
                key={`${scenario.id}-typing`}
                layout="position"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.12 } }}
                transition={SPRING}
                className={cn(
                  "flex w-fit items-center gap-1 self-end rounded-2xl rounded-br-sm px-3.5 py-3",
                  typing === "ai" ? "bg-primary text-primary-foreground" : "border bg-background",
                )}
              >
                <span className="sr-only">
                  {typing === "ai" ? "L’IA rédige une réponse" : `${agent} écrit`}
                </span>
                {[0, 1, 2].map((dot) => (
                  <m.span
                    key={dot}
                    aria-hidden="true"
                    className="size-1.5 rounded-full bg-current"
                    animate={{ opacity: [0.35, 1, 0.35], y: [0, -2, 0] }}
                    transition={{ duration: 1, repeat: Infinity, delay: dot * 0.16, ease: "easeInOut" }}
                  />
                ))}
              </m.li>
            )}
          </AnimatePresence>
        </ol>
      </div>

      <div aria-hidden="true" className="flex items-center gap-2 border-t px-3 py-2.5">
        <span className="flex h-9 flex-1 items-center rounded-full border bg-background px-4 text-xs text-muted-foreground">
          {handedOver ? `${agent} répond…` : "L’IA répond pour vous"}
        </span>
        <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Mic className="size-4" />
        </span>
      </div>
    </div>
  );
}

function MessageBubble({ message, agent }: { message: SimMessage; agent: string }) {
  if (message.speaker === "system") {
    return (
      <m.li
        layout="position"
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={SPRING}
        className="flex items-center gap-1.5 self-center rounded-full border bg-background px-3 py-1 font-mono text-[11px] text-muted-foreground"
      >
        <UserRoundCheck aria-hidden="true" className="size-3.5 text-foreground" />
        {message.text}
      </m.li>
    );
  }

  const fromClient = message.speaker === "client";
  const author = message.speaker === "ai" ? "IA" : message.speaker === "agent" ? agent : null;

  return (
    <m.li
      layout="position"
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={SPRING}
      className={cn(
        "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-snug sm:max-w-[78%]",
        fromClient && "self-start rounded-bl-sm bg-muted",
        message.speaker === "ai" && "self-end rounded-br-sm bg-primary text-primary-foreground",
        message.speaker === "agent" && "self-end rounded-br-sm border bg-background",
      )}
    >
      {author && (
        <span className="mb-1 flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider opacity-70">
          {message.speaker === "ai" ? (
            <Sparkles aria-hidden="true" className="size-3" />
          ) : (
            <UserRoundCheck aria-hidden="true" className="size-3" />
          )}
          {author}
        </span>
      )}
      {message.voice ? (
        <span className="flex items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
            <Play aria-hidden="true" className="size-3 fill-current" />
          </span>
          <span aria-hidden="true" className="flex h-6 items-center gap-0.5">
            {VOICE_BARS.map((height, index) => (
              <span
                key={index}
                className="w-0.5 rounded-full bg-foreground/60"
                style={{ height: `${height * 10}%` }}
              />
            ))}
          </span>
          <span className="font-mono text-[11px] text-muted-foreground">
            <span className="sr-only">{message.text}, </span>
            {message.voice.duration}
          </span>
        </span>
      ) : (
        <span className="text-pretty">{message.text}</span>
      )}
      <span
        className={cn(
          "mt-1 flex items-center justify-end gap-1 font-mono text-[10px]",
          fromClient ? "text-muted-foreground" : "opacity-70",
        )}
      >
        {message.time}
        {!fromClient && (
          <>
            <CheckCheck aria-hidden="true" className="size-3" />
            <span className="sr-only">lu</span>
          </>
        )}
      </span>
    </m.li>
  );
}

interface TracePanelProps {
  scenario: Scenario;
  steps: TraceStep[];
  finished: boolean;
}

function TracePanel({ scenario, steps, finished }: TracePanelProps) {
  const sent = steps.find((step) => step.label === "Envoyé" || step.label === "Transfert");

  return (
    <aside
      aria-label="Trace de décision de l’IA"
      className="flex flex-col border-t bg-muted/40 md:border-l md:border-t-0"
    >
      <div className="flex items-center justify-between border-b px-4 py-3">
        <p className="flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-widest">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full rounded-full bg-foreground opacity-60 motion-safe:animate-ping" />
            <span className="relative inline-flex size-1.5 rounded-full bg-foreground" />
          </span>
          Trace IA
        </p>
        <p className="font-mono text-[11px] text-muted-foreground">
          {sent ? (
            <>
              <span className="sr-only">Première action en </span>
              <span className="text-foreground">{sent.at}</span>
            </>
          ) : (
            "—"
          )}
        </p>
      </div>

      <ol className="relative flex flex-1 flex-col gap-4 px-4 py-4 before:absolute before:bottom-4 before:left-[1.4rem] before:top-5 before:w-px before:bg-border md:min-h-0">
        <AnimatePresence initial={false}>
          {steps.map((step, index) => {
            const latest = index === steps.length - 1 && !finished;
            return (
              <m.li
                key={step.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.45, ease: EASE_OUT }}
                className="relative grid grid-cols-[0.875rem_1fr] gap-3"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "relative z-10 mt-1 size-3.5 rounded-full border-2 border-muted bg-muted-foreground/50 transition-colors",
                    latest && "bg-foreground",
                  )}
                />
                <span className="min-w-0">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-medium">{step.label}</span>
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{step.at}</span>
                  </span>
                  <span className="mt-0.5 block text-pretty font-mono text-[11px] leading-snug text-muted-foreground">
                    {step.detail}
                  </span>
                </span>
              </m.li>
            );
          })}
        </AnimatePresence>
      </ol>

      <div className="border-t px-4 py-3">
        <AnimatePresence mode="wait" initial={false}>
          {finished ? (
            <m.div
              key="outcome"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: EASE_OUT }}
              className="flex items-start gap-2.5"
            >
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Sparkles aria-hidden="true" className="size-3.5" />
              </span>
              <span>
                <span className="block text-xs font-medium">{scenario.outcome.label}</span>
                <span className="block font-mono text-[11px] leading-snug text-muted-foreground">
                  {scenario.outcome.detail}
                </span>
              </span>
            </m.div>
          ) : (
            <m.p
              key="pending"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="ai-thinking-shimmer font-mono text-[11px]"
            >
              Analyse de la conversation…
            </m.p>
          )}
        </AnimatePresence>
      </div>
    </aside>
  );
}
