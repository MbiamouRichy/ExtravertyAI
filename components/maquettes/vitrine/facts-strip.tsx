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
      <dl ref={ref} className="grid grid-cols-2 gap-px bg-border lg:grid-cols-4">
        {FACTS.map((fact) => (
          <div
            key={fact.label}
            className="flex flex-col-reverse justify-end gap-3 bg-background px-4 py-8 sm:px-8 md:py-10 lg:px-12"
          >
            <dt className="max-w-48 text-xs text-muted-foreground sm:text-sm">{fact.label}</dt>
            <dd className="font-heading text-4xl font-bold tracking-tight md:text-5xl">
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
