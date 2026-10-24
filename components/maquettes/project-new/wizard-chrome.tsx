import Link from "next/link";
import { ChevronRight, X } from "lucide-react";

import { LogoIcon } from "@/components/logo";
import { ModeToggle } from "@/components/theming";
import { Button } from "@/components/ui/button";
import { Serif } from "@/components/website/vitrine/primitives";

/*
 * Layout shared by the wizard and its loading.tsx: both use these classes so
 * nothing moves when the real page replaces the skeleton.
 */
export const WIZARD_GRID =
  "mx-auto grid w-full max-w-7xl flex-1 lg:grid-cols-[minmax(0,1fr)_26rem] xl:grid-cols-[minmax(0,1fr)_30rem]";
export const WIZARD_MAIN =
  "min-w-0 px-4 pt-8 pb-40 sm:px-8 sm:pt-10 lg:pr-12 lg:pb-16 xl:pl-12";
export const WIZARD_ASIDE =
  "relative hidden border-l bg-muted/30 lg:block";
export const WIZARD_ASIDE_INNER =
  "sticky top-14 flex h-[calc(100dvh-3.5rem)] flex-col items-center justify-center gap-5 px-6 py-6";

export function WizardTopBar() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-backdrop-filter:bg-background/70">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-8 xl:px-12">
        <Link
          href="/maquettes"
          aria-label="ExtravertyAI, retour aux maquettes"
          className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <LogoIcon LogoClassName="w-6" className="gap-1.5" />
        </Link>
        <span aria-hidden="true" className="hidden h-5 w-px bg-border sm:block" />
        <nav aria-label="Fil d’Ariane" className="hidden min-w-0 sm:block">
          <ol className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
            <li>Projets</li>
            <li aria-hidden="true">
              <ChevronRight className="size-3.5" />
            </li>
            <li aria-current="page" className="truncate text-foreground">
              Nouveau projet
            </li>
          </ol>
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <span className="hidden items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] text-muted-foreground md:inline-flex">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-muted-foreground" />
            Maquette · rien n’est envoyé
          </span>
          <ModeToggle screen="desktop" />
          <Button asChild variant="ghost" size="icon">
            <Link href="/maquettes" aria-label="Quitter la création du projet">
              <X />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

export function WizardIntro() {
  return (
    <div className="mb-8 sm:mb-10">
      <p className="font-mono text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
        Nouveau projet
      </p>
      <h1 className="mt-3 max-w-2xl text-4xl text-balance sm:text-5xl">
        Votre agent WhatsApp, <Serif>prêt en quatre étapes.</Serif>
      </h1>
      <p className="mt-4 max-w-xl text-sm text-muted-foreground sm:text-base">
        Configurez-le ici : l’aperçu montre en direct ce que vos clients
        verront.
      </p>
    </div>
  );
}
