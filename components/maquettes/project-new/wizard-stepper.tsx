"use client";

import { m } from "motion/react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EASE_OUT } from "@/components/website/vitrine/motion";

import { WIZARD_STEPS } from "./data";

interface WizardStepperProps {
  current: number;
  /** Furthest step already validated: earlier steps stay reachable. */
  reached: number;
  disabled?: boolean;
  onSelect: (index: number) => void;
}

export function WizardStepper({
  current,
  reached,
  disabled = false,
  onSelect,
}: WizardStepperProps) {
  return (
    <nav aria-label="Étapes de création" className="mb-10">
      <ol className="grid grid-cols-4 gap-2 sm:gap-3">
        {WIZARD_STEPS.map((step, index) => {
          const state =
            index < current ? "complete" : index === current ? "current" : "upcoming";
          const reachable = index <= reached;

          return (
            <li key={step.id} className="min-w-0">
              <Button
                type="button"
                variant="ghost"
                disabled={disabled || !reachable}
                aria-current={state === "current" ? "step" : undefined}
                onClick={() => {
                  if (index !== current) onSelect(index);
                }}
                className="group h-auto w-full flex-col items-stretch gap-2.5 rounded-sm px-0 py-1.5 hover:bg-transparent disabled:opacity-100 dark:hover:bg-transparent"
              >
                <span className="relative h-0.5 overflow-hidden rounded-full bg-border">
                  <m.span
                    aria-hidden="true"
                    className="absolute inset-0 origin-left bg-foreground"
                    initial={false}
                    animate={{ scaleX: index <= current ? 1 : 0 }}
                    transition={{ duration: 0.55, ease: EASE_OUT }}
                  />
                </span>
                <span
                  className={cn(
                    "flex min-w-0 items-center gap-1.5 font-mono text-[11px] tracking-wide transition-colors",
                    state === "upcoming" ? "text-muted-foreground" : "text-foreground",
                    state === "complete" && "group-hover:text-muted-foreground",
                  )}
                >
                  {state === "complete" ? (
                    <Check aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={2.5} />
                  ) : (
                    <span aria-hidden="true" className="tabular-nums">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  )}
                  <span
                    className={cn(
                      "truncate uppercase",
                      state !== "current" && "max-sm:sr-only",
                    )}
                  >
                    {step.label}
                  </span>
                  <span className="sr-only">
                    {state === "complete"
                      ? " (terminée)"
                      : state === "current"
                        ? " (étape en cours)"
                        : ""}
                  </span>
                </span>
              </Button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
