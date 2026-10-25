import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";

import { Reveal } from "@/components/website/vitrine/motion";
import {
  SectionIntro,
  SectionShell,
  Serif,
} from "@/components/website/vitrine/primitives";

import { NEXT_STEPS, SHORTCUTS } from "./data";

export function ContactNextSteps() {
  return (
    <SectionShell labelledBy="ensuite-titre">
      <SectionIntro
        index="02"
        eyebrow="Après votre message"
        titleId="ensuite-titre"
        title={
          <>
            Et ensuite ? <Serif>Trois étapes.</Serif>
          </>
        }
      />
      <ol className="grid gap-px border-t bg-border md:grid-cols-3">
        {NEXT_STEPS.map((step, index) => (
          <li key={step.title} className="relative bg-background">
            <Reveal delay={index * 0.08} className="h-full px-4 py-10 sm:px-8 lg:px-12">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {index < NEXT_STEPS.length - 1 && (
                  <ArrowRight aria-hidden="true" className="hidden size-4 text-muted-foreground md:block" />
                )}
              </div>
              <h3 className="mt-10 font-heading text-xl font-semibold tracking-tight">{step.title}</h3>
              <p className="mt-2 max-w-xs text-sm text-muted-foreground">{step.text}</p>
            </Reveal>
          </li>
        ))}
      </ol>
    </SectionShell>
  );
}

export function ContactShortcuts() {
  return (
    <section aria-label="Raccourcis" className="border-t">
      <ul className="grid gap-px bg-border sm:grid-cols-3">
        {SHORTCUTS.map((item) => (
          <li key={item.href} className="bg-background">
            <Link
              href={item.href}
              className="group flex h-full items-center justify-between gap-4 px-4 py-8 outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset sm:px-8"
            >
              <span>
                <span className="block font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
                  {item.label}
                </span>
                <span className="mt-1.5 block font-heading text-lg font-semibold">{item.title}</span>
              </span>
              <ArrowUpRight
                aria-hidden="true"
                className="size-5 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none"
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
