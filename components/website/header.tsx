"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Menu } from "lucide-react";

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

export const navLinks = [
  { label: "Produit", href: "/#produit" },
  { label: "Cas d’usage", href: "/#cas-usage" },
  { label: "Tarifs", href: "/#tarifs" },
  { label: "FAQ", href: "/#faq" },
  { label: "Contact", href: "/contact" },
];

export function Header() {
  const scrolled = useScroll(12);
  const [open, setOpen] = useState(false);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b border-transparent transition-[background-color,border-color] duration-300",
        scrolled &&
          "border-border bg-background/75 backdrop-blur-xl supports-backdrop-filter:bg-background/60",
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
        className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6"
      >
        <Link
          href="/"
          className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <LogoIcon LogoClassName="w-6" className="gap-1.5" />
          <span className="sr-only">Accueil ExtravertyAI</span>
        </Link>

        <ul className="hidden items-center gap-1 lg:flex">
          {navLinks.map((item) => (
            <li key={item.href}>
              <Button asChild variant="ghost" size="sm">
                <Link href={item.href} className="text-muted-foreground">
                  {item.label}
                </Link>
              </Button>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-2 lg:flex">
          <ModeToggle screen="desktop" />
          <Button asChild variant="ghost" size="sm">
            <Link href="/sign-in">Se connecter</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/sign-up">
              Essai gratuit
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden">
              <Menu />
              <span className="sr-only">Ouvrir le menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full max-w-xs">
            <SheetHeader>
              <SheetTitle>Menu</SheetTitle>
              <SheetDescription className="sr-only">
                Navigation du site ExtravertyAI
              </SheetDescription>
            </SheetHeader>
            <ul className="flex flex-col gap-1 px-4">
              {navLinks.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="block rounded-md px-3 py-2.5 text-base hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                  >
                    {item.label}
                  </Link>
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
