import Link from "next/link";

import { LogoIcon } from "@/components/logo";
import { FacebookIcon, WhatsAppIcon } from "@/components/social-icon";
import { Button } from "@/components/ui/button";

const COLUMNS = [
  {
    title: "Produit",
    links: [
      { label: "Démo", href: "#demo" },
      { label: "Parcours d’un message", href: "#parcours" },
      { label: "Fonctionnalités", href: "#fonctionnalites" },
      { label: "Tarifs", href: "#tarifs" },
    ],
  },
  {
    title: "Entreprise",
    links: [
      { label: "À propos", href: "/apropos" },
      { label: "Contact", href: "/contact" },
      { label: "Mon espace", href: "/projects" },
    ],
  },
  {
    title: "Légal",
    links: [{ label: "Données et confidentialité", href: "/donneesEtConfidentialite" }],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="overflow-hidden sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl border-t sm:border-x">
        <div className="grid grid-cols-2 gap-x-6 gap-y-12 px-4 py-16 sm:px-8 md:grid-cols-12 lg:px-12">
          <div className="col-span-2 space-y-5 md:col-span-4">
            <Link
              href="#contenu"
              className="inline-flex rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <LogoIcon LogoClassName="w-6" className="gap-1.5" />
              <span className="sr-only">Haut de page ExtravertyAI</span>
            </Link>
            <p className="max-w-xs text-sm text-muted-foreground">
              L’assistant WhatsApp qui répond, qualifie et passe la main à votre
              équipe au bon moment.
            </p>
            <div className="flex gap-1">
              <Button asChild size="icon-sm" variant="outline">
                <a
                  href="https://www.facebook.com/profile.php?id=61576441577255"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="ExtravertyAI sur Facebook"
                >
                  <FacebookIcon />
                </a>
              </Button>
              <Button asChild size="icon-sm" variant="outline">
                <a
                  href="https://wa.me/24176205629"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Écrire à ExtravertyAI sur WhatsApp"
                >
                  <WhatsAppIcon />
                </a>
              </Button>
            </div>
          </div>
          {COLUMNS.map((column) => (
            <nav key={column.title} aria-label={column.title} className="md:col-span-3 md:last:col-span-2">
              <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                {column.title}
              </p>
              <ul className="space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="rounded-sm text-sm outline-none transition-colors hover:text-muted-foreground focus-visible:underline focus-visible:underline-offset-4"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="flex flex-col gap-2 border-t px-4 py-5 font-mono text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
          <p>© {new Date().getFullYear()} ExtravertyAI. Tous droits réservés.</p>
          <p>WhatsApp est une marque de Meta Platforms, Inc.</p>
        </div>

        <p
          aria-hidden="true"
          className="select-none whitespace-nowrap bg-linear-to-b from-foreground/15 to-transparent bg-clip-text px-2 pt-4 text-center font-heading text-[12.5vw] font-extrabold leading-[0.8] tracking-tighter text-transparent xl:text-[10rem]"
        >
          ExtravertyAI
        </p>
      </div>
    </footer>
  );
}
