import Link from "next/link";

import { LogoIcon } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { FacebookIcon, WhatsAppIcon } from "@/components/social-icon";

const columns = [
  {
    title: "Produit",
    links: [
      { label: "Fonctionnalités", href: "/#produit" },
      { label: "Cas d’usage", href: "/#cas-usage" },
      { label: "Tarifs", href: "/#tarifs" },
      { label: "Questions fréquentes", href: "/#faq" },
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
    links: [
      { label: "Données et confidentialité", href: "/donneesEtConfidentialite" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="space-y-4">
          <Link
            href="/"
            className="inline-flex rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <LogoIcon LogoClassName="w-6" className="gap-1.5" />
            <span className="sr-only">Accueil ExtravertyAI</span>
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
        {columns.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <p className="mb-3 font-heading text-sm font-semibold">{column.title}</p>
            <ul className="space-y-2">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:underline focus-visible:outline-none"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} ExtravertyAI. Tous droits réservés.</p>
          <p>WhatsApp est une marque de Meta Platforms, Inc.</p>
        </div>
      </div>
    </footer>
  );
}
