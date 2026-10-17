"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Menu } from "lucide-react";
import { m } from "motion/react";

import { cn } from "@/lib/utils";
import { useScroll } from "@/hooks/use-scroll";
import { LogoIcon } from "@/components/logo";
import { ModeToggle } from "@/components/theming";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import { SECTIONS, type SectionId } from "./data";
import { SPRING } from "./motion";

/** Highlights the section currently crossing the middle of the viewport. */
function useActiveSection(): SectionId | null {
  const [active, setActive] = useState<SectionId | null>(null);

  useEffect(() => {
    const elements = SECTIONS.map(({ id }) => document.getElementById(id)).filter(
      (element): element is HTMLElement => element !== null,
    );
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id as SectionId);
        }
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return active;
}

export function SiteNav() {
  const scrolled = useScroll(16);
  const active = useActiveSection();
  const [open, setOpen] = useState(false);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b border-transparent transition-[background-color,border-color] duration-300",
        scrolled && "border-border bg-background/80 backdrop-blur-xl",
      )}
    >
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Aller au contenu
      </a>
      <nav
        aria-label="Navigation principale"
        className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-8 lg:px-12"
      >
        <Link
          href="#contenu"
          className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <LogoIcon LogoClassName="w-6" className="gap-1.5" />
          <span className="sr-only">Haut de page ExtravertyAI</span>
        </Link>

        <ul className="hidden items-center gap-0.5 rounded-full border bg-background/60 p-1 backdrop-blur xl:flex">
          {SECTIONS.map((section) => {
            const isActive = active === section.id;
            return (
              <li key={section.id} className="relative">
                {isActive && (
                  <m.span
                    layoutId="vitrine-nav-pill"
                    transition={SPRING}
                    aria-hidden="true"
                    className="absolute inset-0 rounded-full bg-muted"
                  />
                )}
                <a
                  href={`#${section.id}`}
                  aria-current={isActive ? "location" : undefined}
                  className={cn(
                    "relative block rounded-full px-3.5 py-1.5 text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
                    isActive && "text-foreground",
                  )}
                >
                  {section.label}
                </a>
              </li>
            );
          })}
        </ul>

        <div className="ml-auto hidden items-center gap-1.5 md:flex xl:ml-0">
          <ModeToggle screen="desktop" />
          <Button asChild variant="ghost" size="sm">
            <Link href="/sign-in">Se connecter</Link>
          </Button>
          <Button asChild size="sm" className="group">
            <Link href="/sign-up">
              Essai gratuit
              <ArrowRight
                data-icon="inline-end"
                className="transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          </Button>
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="xl:hidden">
              <Menu />
              <span className="sr-only">Ouvrir le menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full max-w-xs">
            <SheetHeader>
              <SheetTitle>Menu</SheetTitle>
              <SheetDescription className="sr-only">
                Sections de la page ExtravertyAI
              </SheetDescription>
            </SheetHeader>
            <ul className="flex flex-col gap-1 px-4">
              {SECTIONS.map((section, index) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    onClick={() => setOpen(false)}
                    aria-current={active === section.id ? "location" : undefined}
                    className="flex items-baseline gap-3 rounded-md px-3 py-2.5 text-base outline-none hover:bg-muted focus-visible:bg-muted aria-[current=location]:bg-muted"
                  >
                    <span className="font-mono text-xs text-muted-foreground">
                      0{index + 1}
                    </span>
                    {section.label}
                  </a>
                </li>
              ))}
            </ul>
            <div className="mt-auto flex flex-col gap-3 p-4">
              <ModeToggle screen="mobile" />
              <Button asChild variant="outline" size="lg">
                <Link href="/sign-in" onClick={() => setOpen(false)}>
                  Se connecter
                </Link>
              </Button>
              <Button asChild size="lg">
                <Link href="/sign-up" onClick={() => setOpen(false)}>
                  Essai gratuit
                </Link>
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </header>
  );
}
