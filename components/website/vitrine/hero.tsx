import Link from "next/link";
import { AccountButton } from "./account-button";
import { ArrowRight, Check } from "lucide-react";

import { Button } from "@/components/ui/button";

import { ConversationSimulator } from "./conversation-simulator";
import { Eyebrow, Serif } from "./primitives";

const HEADLINE: readonly { word: string; accent?: boolean }[] = [
  { word: "Chaque" },
  { word: "message" },
  { word: "mérite" },
  { word: "une" },
  { word: "réponse" },
  { word: "immédiate.", accent: true },
];

const REASSURANCE = ["10 jours d’essai gratuit", "Prêt en 5 minutes", "Sans engagement"];

const SECTORS = ["E-commerce", "Beauté", "Restauration", "Immobilier", "Services"];

// CSS-only entrance so the headline animates before hydration and never delays LCP.
const ENTER =
  "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:fill-mode-backwards motion-safe:duration-700";

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative isolate">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-size-[4.5rem_4.5rem] mask-[radial-gradient(ellipse_70%_55%_at_60%_0%,black,transparent)] opacity-70"
      />

      <div className="px-4 pt-12 sm:px-8 md:pt-20 lg:px-12">
        <Link
          href="#fonctionnalites"
          className={`group inline-flex items-center gap-2 rounded-full border bg-background/80 py-1 pl-1 pr-3 text-xs shadow-xs outline-none backdrop-blur transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 ${ENTER}`}
        >
          <span className="rounded-full bg-primary px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary-foreground">
            Nouveau
          </span>
          Pipeline de prospects et intégrations
          <ArrowRight
            aria-hidden="true"
            className="size-3 transition-transform group-hover:translate-x-0.5"
          />
        </Link>

        <h1
          id="hero-title"
          className="mt-8 max-w-6xl text-balance text-5xl sm:text-7xl lg:text-8xl"
        >
          {HEADLINE.map(({ word, accent }, index) => (
            <span key={word}>
              <span
                className={`inline-block motion-safe:blur-in ${ENTER}`}
                style={{ animationDelay: `${80 + index * 70}ms` }}
              >
                {accent ? <Serif className="pr-1">{word}</Serif> : word}
              </span>
              {index < HEADLINE.length - 1 && " "}
            </span>
          ))}
        </h1>
      </div>

      <div className="grid gap-12 px-4 pb-20 pt-10 sm:px-8 md:pt-14 lg:px-12 xl:grid-cols-12 xl:gap-10">
        <div
          className={`grid min-w-0 gap-10 md:grid-cols-2 md:items-end xl:col-span-4 xl:flex xl:flex-col xl:items-stretch xl:justify-between ${ENTER}`}
          style={{ animationDelay: "520ms" }}
        >
          <div>
            <p className="max-w-md text-pretty text-base text-muted-foreground md:text-lg">
              ExtravertyAI répond à vos clients WhatsApp en quelques secondes,
              de jour comme de nuit, qualifie vos prospects et passe la main à
              votre équipe dès qu’un humain fait la différence.{" "}
              <span className="text-foreground">Sans changer de numéro.</span>
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row md:flex-col md:items-start xl:items-stretch">
              <AccountButton
                href="/sign-up"
                size="lg"
                className="group h-11 px-5"
                signedInLabel={
                  <>
                    Ouvrir mon espace
                    <ArrowRight
                      data-icon="inline-end"
                      className="transition-transform group-hover:translate-x-0.5"
                    />
                  </>
                }
              >
                Démarrer l’essai gratuit
                <ArrowRight
                  data-icon="inline-end"
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </AccountButton>
              <Button asChild size="lg" variant="outline" className="h-11 px-5">
                <Link href="#parcours">Comment ça marche</Link>
              </Button>
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
              {REASSURANCE.map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <Check aria-hidden="true" className="size-3.5 text-foreground" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t pt-5">
            <Eyebrow className="text-[10px]">Pensé pour les entreprises qui vivent sur WhatsApp</Eyebrow>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {SECTORS.map((sector) => (
                <li
                  key={sector}
                  className="rounded-full border px-2.5 py-1 font-mono text-[11px] text-muted-foreground"
                >
                  {sector}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div
          className={`relative min-w-0 xl:col-span-8 motion-safe:zoom-in-95 ${ENTER}`}
          style={{ animationDelay: "380ms" }}
        >
          <ConversationSimulator />
        </div>
      </div>
    </section>
  );
}
