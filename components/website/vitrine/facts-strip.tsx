"use client";

import { useRef } from "react";
import NumberFlow from "@number-flow/react";
import { useInView } from "motion/react";

import { FACTS } from "./data";

export function FactsStrip() {
  const ref = useRef<HTMLDListElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });

  return (
    <section aria-label="ExtravertyAI en chiffres" className="border-t">
      <dl ref={ref} className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
        {FACTS.map((fact) => (
          <div
            key={fact.label}
            className="flex flex-row-reverse items-center justify-end gap-4 bg-background px-4 py-5 sm:flex-col-reverse sm:items-start sm:gap-3 sm:px-8 sm:py-8 md:py-10 lg:px-12"
          >
            <dt className="min-w-0 flex-1 text-sm text-muted-foreground sm:max-w-48 sm:flex-none">{fact.label}</dt>
            <dd className="w-30 shrink-0 font-heading text-2xl font-bold tracking-tight whitespace-nowrap sm:w-auto sm:text-4xl md:text-5xl">
              <span className="sr-only">
                {fact.prefix}
                {fact.value}
                {fact.suffix}
              </span>
              <NumberFlow
                aria-hidden="true"
                value={inView ? fact.value : 0}
                prefix={fact.prefix}
                suffix={fact.suffix}
                locales="fr-FR"
                transformTiming={{ duration: 900, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                spinTiming={{ duration: 1100, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }}
              />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
