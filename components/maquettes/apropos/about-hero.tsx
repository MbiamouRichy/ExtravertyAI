import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Crosshair, Eyebrow, Serif } from "@/components/website/vitrine/primitives";

import { BeforeAfterThread } from "./before-after-thread";

/** Headline and manifesto, shared with loading.tsx so the title never shifts. */
export function AboutHeroCopy({ titleAs: Title = "h1" }: { titleAs?: "h1" | "p" }) {
  return (
    <div className="grid gap-10 px-4 pt-14 pb-16 sm:px-8 md:pt-20 lg:grid-cols-12 lg:items-end lg:gap-8 lg:px-12 lg:pb-24">
      <div className="lg:col-span-8">
        <Eyebrow>
          <span className="text-foreground">À propos</span>
          <span aria-hidden="true"> / </span>
          Notre conviction
        </Eyebrow>
        <Title
          id={Title === "h1" ? "apropos-titre" : undefined}
          className="mt-6 font-heading text-5xl leading-[1.06] font-extrabold tracking-[-0.055em] text-balance sm:text-6xl lg:text-8xl"
        >
          La technologie avance. <Serif>La relation reste.</Serif>
        </Title>
      </div>
      <div className="max-w-md lg:col-span-4 lg:pb-3">
        <p className="text-lg text-pretty sm:text-xl">
          Nous construisons ExtravertyAI pour que les entreprises passent moins de
          temps à répéter, et plus de temps à créer du lien.
        </p>
        <p className="mt-4 text-sm text-pretty text-muted-foreground">
          Une IA qui accueille vos clients sur WhatsApp, et une équipe qui garde
          toujours la main.
        </p>
      </div>
    </div>
  );
}

export function AboutHero() {
  return (
    <>
      <section aria-labelledby="apropos-titre">
        <AboutHeroCopy />
      </section>

      <section aria-labelledby="depart-titre" className="relative border-t">
        <Crosshair className="-top-1.5 -left-1.5" />
        <Crosshair className="-top-1.5 -right-1.5" />
        <div className="grid lg:grid-cols-12">
          <div className="flex flex-col justify-between gap-10 px-4 py-14 sm:px-8 lg:col-span-5 lg:px-12 lg:py-20">
            <div>
              <Eyebrow>
                <span className="text-foreground">00</span>
                <span aria-hidden="true"> / </span>
                Le point de départ
              </Eyebrow>
              <h2 id="depart-titre" className="mt-6 text-4xl text-balance tracking-tight md:text-5xl">
                Derrière chaque message, <Serif>une personne.</Serif>
              </h2>
              <p className="mt-6 text-pretty text-muted-foreground">
                Une question à 23 h 47. Un client qui hésite. Une demande qui arrive
                après une longue journée. Ces petits échanges décident souvent d’une
                vente.
              </p>
              <p className="mt-4 text-pretty text-muted-foreground">
                Notre ambition : que chacun reçoive une réponse juste, à toute heure,
                et que la bonne personne prenne le relais quand cela compte.
              </p>
            </div>
            <Button asChild variant="outline" size="lg" className="group w-fit">
              <Link href="/maquettes/contact">
                Faisons connaissance
                <ArrowUpRight
                  aria-hidden="true"
                  data-icon="inline-end"
                  className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </Link>
            </Button>
          </div>
          <div className="border-t lg:col-span-7 lg:border-t-0 lg:border-l">
            <BeforeAfterThread />
          </div>
        </div>
      </section>
    </>
  );
}
