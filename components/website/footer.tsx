"use client";

import { LogoIcon } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { LogIn } from "lucide-react";
import Link from "next/link";
import { navLinks } from "./header";
import { FacebookIcon } from "../social-icon";

export default function Footer() {
  return (
    <footer className="w-full border-t bg-background">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
        <div className="grid gap-10 py-10 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr] lg:gap-16">
          <div className="min-w-0">
            <Link
              href="/"
              aria-label="ExtravertyAI — accueil"
              className="inline-flex rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              <LogoIcon LogoClassName="w-7" />
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Vos conversations WhatsApp, votre assistant IA et votre équipe
              dans un même espace.
            </p>
            <Button asChild size="icon-sm" variant="ghost" className="mt-3">
              <a
                href="https://www.facebook.com/profile.php?id=61576441577255"
                aria-label="ExtravertyAI sur Facebook"
              >
                <FacebookIcon />
              </a>
            </Button>
          </div>
          <nav aria-label="Navigation de bas de page">
            <p className="mb-4 text-sm font-semibold">Découvrir</p>
            <ul className="grid grid-cols-2 gap-x-5 gap-y-1 text-sm text-muted-foreground">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="inline-flex min-h-10 items-center rounded-sm hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div>
            <p className="text-sm font-semibold">Votre espace</p>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Retrouvez vos projets et vos conversations.
            </p>
            <Button asChild className="mt-5">
              <Link href="/sign-in">
                <LogIn aria-hidden="true" />
                Se connecter
              </Link>
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-3 border-t py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© ExtravertyAI. Tous droits réservés.</p>
          <Link
            href="/donneesEtConfidentialite"
            className="inline-flex min-h-10 items-center rounded-sm underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            Données et confidentialité
          </Link>
        </div>
      </div>
    </footer>
  );
}
