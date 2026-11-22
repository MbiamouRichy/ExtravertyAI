"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Menu } from "lucide-react";

import { LogoIcon } from "@/components/logo";
import { ModeToggle } from "@/components/theming";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AccountButton } from "@/components/website/vitrine/account-button";
import type { HelpNavGroup } from "@/lib/help-center/articles";
import type { HelpSearchEntry } from "@/lib/help-center/search";

import { HelpSearch } from "./help-search";
import { HelpSidebar } from "./help-sidebar";

export function HelpHeader({
  groups,
  searchIndex,
  suggestions,
}: {
  groups: HelpNavGroup[];
  searchIndex: HelpSearchEntry[];
  suggestions: HelpSearchEntry[];
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-xl">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Aller au contenu
      </a>
      <div className="mx-auto flex h-16 w-full max-w-[90rem] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="-ml-2 lg:hidden">
              <Menu />
              <span className="sr-only">Ouvrir les rubriques</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-full max-w-xs overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Centre d’aide</SheetTitle>
              <SheetDescription className="sr-only">Rubriques et articles de l’aide ExtravertyAI</SheetDescription>
            </SheetHeader>
            <div className="px-3">
              <HelpSidebar groups={groups} onNavigate={() => setMenuOpen(false)} />
            </div>
            <div className="mt-auto border-t p-4 text-sm">
              <ModeToggle screen="mobile" />
            </div>
          </SheetContent>
        </Sheet>

        <Link
          href="/aide"
          className="flex shrink-0 items-center gap-2 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <LogoIcon LogoClassName="w-6" className="gap-1.5" />
          <span aria-hidden="true" className="hidden h-5 w-px bg-border sm:block" />
          <span className="hidden text-sm font-medium text-muted-foreground sm:block">Aide</span>
          <span className="sr-only">Accueil du centre d’aide</span>
        </Link>

        <div className="mx-auto hidden w-full max-w-sm md:block">
          <HelpSearch index={searchIndex} suggestions={suggestions} />
        </div>

        <div className="ml-auto flex items-center gap-1.5 md:ml-0">
          <div className="md:hidden">
            <HelpSearch index={searchIndex} suggestions={suggestions} variant="icon" />
          </div>
          <div className="hidden sm:block">
            <ModeToggle screen="desktop" />
          </div>
          <AccountButton
            href="/sign-in?callbackUrl=/projects"
            size="sm"
            variant="default"
            className="group"
            signedInLabel={
              <>
                Ouvrir l’app
                <ArrowRight data-icon="inline-end" className="transition-transform group-hover:translate-x-0.5" />
              </>
            }
          >
            Se connecter
          </AccountButton>
        </div>
      </div>
    </header>
  );
}
