"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, m, type Variants } from "motion/react";
import { CheckCheck, MoonStar, Sparkles, UserRoundCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EASE_OUT, SPRING, useAutoplay } from "@/components/website/vitrine/motion";

import { THREAD_MODES, THREADS, type ThreadMessage, type ThreadMode } from "./data";

const AUTO_SWITCH_MS = 3200;

/**
 * The same late question handled twice. Switches once to « Avec » when first
 * seen, then leaves the visitor in control.
 */
export function BeforeAfterThread() {
  const [mode, setMode] = useState<ThreadMode>("without");
  const [touched, setTouched] = useState(false);
  const { ref, canPlay } = useAutoplay<HTMLDivElement>(0.5);
  const thread = THREADS[mode];

  useEffect(() => {
    if (!canPlay || touched || mode === "with") return;
    const timer = setTimeout(() => setMode("with"), AUTO_SWITCH_MS);
    return () => clearTimeout(timer);
  }, [canPlay, touched, mode]);

  return (
    <div ref={ref} className="flex min-w-0 flex-col">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-6">
        <div
          role="group"
          aria-label="Comparer les deux scénarios"
          className="flex rounded-lg border bg-background p-0.5"
        >
          {THREAD_MODES.map((option) => {
            const selected = option.id === mode;
            return (
              <Button
                key={option.id}
                type="button"
                size="sm"
                variant="ghost"
                aria-pressed={selected}
                onClick={() => {
                  setTouched(true);
                  setMode(option.id);
                }}
                className={cn(
                  "relative px-2.5 text-xs text-muted-foreground hover:bg-transparent sm:text-sm dark:hover:bg-transparent",
                  selected && "text-foreground",
                )}
              >
                {selected && (
                  <m.span
                    layoutId="apropos-thread-pill"
                    transition={SPRING}
                    aria-hidden="true"
                    className="absolute inset-0 rounded-[inherit] border bg-muted shadow-xs"
                  />
                )}
                <span className="relative">{option.label}</span>
              </Button>
            );
          })}
        </div>
        <span className="hidden font-mono text-[11px] text-muted-foreground sm:inline">
          Illustration
        </span>
      </div>

      <div className="relative min-h-112 flex-1 bg-muted/40 bg-[radial-gradient(color-mix(in_oklch,var(--foreground)_6%,transparent)_1px,transparent_1px)] bg-size-[14px_14px]">
        <AnimatePresence mode="wait" initial={false}>
          <m.ol
            key={mode}
            aria-label={mode === "with" ? "Conversation avec ExtravertyAI" : "Conversation sans assistant"}
            initial="hidden"
            animate="shown"
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            variants={{ shown: { transition: { staggerChildren: 0.12 } } }}
            className="flex flex-col gap-2.5 p-4 sm:p-6"
          >
            {thread.messages.map((message) => (
              <ThreadLine key={message.id} message={message} />
            ))}
          </m.ol>
        </AnimatePresence>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <m.div
          key={mode}
          role="status"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.3, ease: EASE_OUT }}
          className="flex items-start gap-3 border-t px-4 py-4 sm:px-6"
        >
          <span
            className={cn(
              "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md",
              mode === "with" ? "bg-primary text-primary-foreground" : "border text-muted-foreground",
            )}
          >
            {mode === "with" ? (
              <Sparkles aria-hidden="true" className="size-3.5" />
            ) : (
              <MoonStar aria-hidden="true" className="size-3.5" />
            )}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium">{thread.outcome.label}</span>
            <span className="block text-xs text-muted-foreground">{thread.outcome.detail}</span>
          </span>
        </m.div>
      </AnimatePresence>
    </div>
  );
}

const LINE_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 10, scale: 0.98 },
  shown: { opacity: 1, y: 0, scale: 1, transition: SPRING },
};

function ThreadLine({ message }: { message: ThreadMessage }) {
  if (message.speaker === "gap") {
    return (
      <m.li
        variants={LINE_VARIANTS}
        className="my-2 flex items-center gap-3 font-mono text-[11px] text-muted-foreground"
      >
        <span aria-hidden="true" className="h-px flex-1 border-t border-dashed" />
        <MoonStar aria-hidden="true" className="size-3.5" />
        {message.text}
        <span aria-hidden="true" className="h-px flex-1 border-t border-dashed" />
      </m.li>
    );
  }

  if (message.speaker === "system") {
    return (
      <m.li
        variants={LINE_VARIANTS}
        className="my-1 flex items-center gap-1.5 self-center rounded-full border bg-background px-3 py-1 font-mono text-[11px] text-muted-foreground"
      >
        <UserRoundCheck aria-hidden="true" className="size-3.5 text-foreground" />
        {message.text}
      </m.li>
    );
  }

  const fromClient = message.speaker === "client";

  return (
    <m.li
      variants={LINE_VARIANTS}
      className={cn(
        "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-snug sm:max-w-[75%]",
        fromClient && "self-start rounded-bl-sm border bg-card",
        message.speaker === "ai" && "self-end rounded-br-sm bg-primary text-primary-foreground",
        message.speaker === "agent" && "self-end rounded-br-sm border bg-background",
      )}
    >
      {!fromClient && (
        <span className="mb-1 flex items-center gap-1 font-mono text-[10px] tracking-wider uppercase opacity-70">
          {message.speaker === "ai" ? (
            <Sparkles aria-hidden="true" className="size-3" />
          ) : (
            <UserRoundCheck aria-hidden="true" className="size-3" />
          )}
          {message.speaker === "ai" ? "Assistant IA" : "Votre équipe"}
        </span>
      )}
      <span className="sr-only">{fromClient ? "Client : " : ""}</span>
      <span className="text-pretty">{message.text}</span>
      {message.time && (
        <span
          className={cn(
            "mt-1 flex items-center justify-end gap-1 font-mono text-[10px]",
            fromClient ? "text-muted-foreground" : "opacity-70",
          )}
        >
          {message.time}
          {!fromClient && <CheckCheck aria-hidden="true" className="size-3" />}
        </span>
      )}
    </m.li>
  );
}
