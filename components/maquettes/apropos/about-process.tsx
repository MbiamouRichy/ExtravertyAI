import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/website/vitrine/motion";
import {
  Crosshair,
  Eyebrow,
  Serif,
} from "@/components/website/vitrine/primitives";

import { PROCESS } from "./data";

export function AboutProcess() {
  return (
    <section aria-labelledby="demarche-titre" className="relative border-t">
      <Crosshair className="-top-1.5 -left-1.5" />
      <Crosshair className="-top-1.5 -right-1.5" />
      <div className="grid lg:grid-cols-12">
        <div className="px-4 pt-20 pb-10 sm:px-8 md:pt-28 lg:col-span-5 lg:px-12 lg:pb-28">
          <div className="lg:sticky lg:top-28">
            <Eyebrow>
              <span className="text-foreground">03</span>
              <span aria-hidden="true"> / </span>
              Avancer ensemble
            </Eyebrow>
            <h2 id="demarche-titre" className="mt-6 text-4xl text-balance tracking-tight md:text-5xl">
              De votre besoin à vos <Serif>premiers échanges.</Serif>
            </h2>
            <Button asChild variant="link" className="mt-6 h-11 px-0">
              <Link href="/maquettes/tarifs">
                Découvrir nos offres
                <ArrowRight aria-hidden="true" data-icon="inline-end" />
              </Link>
            </Button>
          </div>
        </div>

        <ol className="border-t lg:col-span-7 lg:border-t-0 lg:border-l">
          {PROCESS.map((step, index) => (
            <li key={step.title} className="border-b last:border-b-0">
              <Reveal delay={index * 0.06} className="grid gap-4 px-4 py-10 sm:grid-cols-[4rem_minmax(0,1fr)] sm:px-8 lg:px-12 lg:py-14">
                <span className="font-heading text-4xl font-bold tracking-tight text-muted-foreground/60 tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
                    <h3 className="font-heading text-2xl font-semibold tracking-tight">{step.title}</h3>
                    <span className="rounded-full border px-2.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                      {step.meta}
                    </span>
                  </div>
                  <p className="mt-3 max-w-lg text-pretty text-muted-foreground">{step.text}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function AboutCta() {
  return (
    <section aria-labelledby="apropos-cta-titre" className="relative border-t">
      <Crosshair className="-top-1.5 -left-1.5 z-10" />
      <Crosshair className="-top-1.5 -right-1.5 z-10" />
      <div className="relative isolate overflow-hidden bg-primary px-4 py-24 text-primary-foreground sm:px-8 md:py-32 lg:px-12">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--primary-foreground)_1px,transparent_1px),linear-gradient(to_bottom,var(--primary-foreground)_1px,transparent_1px)] bg-size-[4.5rem_4.5rem] opacity-10 mask-[radial-gradient(ellipse_70%_80%_at_20%_100%,black,transparent)]"
        />
        <Eyebrow className="text-primary-foreground/60">Construisons la suite</Eyebrow>
        <h2
          id="apropos-cta-titre"
          className="mt-6 max-w-4xl text-5xl text-balance tracking-tight md:text-7xl"
        >
          Votre prochaine bonne conversation <Serif>commence ici.</Serif>
        </h2>
        <div className="mt-12 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" variant="secondary" className="group h-11 px-5">
            <Link href="/maquettes/contact">
              Parlons de votre projet
              <ArrowUpRight
                aria-hidden="true"
                data-icon="inline-end"
                className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="ghost"
            className="h-11 px-5 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground dark:hover:bg-primary-foreground/10"
          >
            <Link href="/maquettes/tarifs">Voir les offres</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
