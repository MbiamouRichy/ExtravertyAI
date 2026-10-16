import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, BarChart3, CalendarClock, CreditCard, Home, LogIn, MessagesSquare } from "lucide-react";

import { LogoIcon } from "@/components/logo";
import { ModeToggle } from "@/components/theming";

export const metadata: Metadata = { title: "Toutes les maquettes" };

const pages: {
  href: string;
  icon: typeof Home;
  title: string;
  text: string;
  live?: string;
}[] = [
  {
    href: "/maquettes/accueil",
    icon: Home,
    title: "Page d’accueil",
    live: "/",
    text: "Hero avec démo animée, étapes, fonctionnalités en bento, cas d’usage, sécurité, FAQ.",
  },
  {
    href: "/maquettes/projects/demo/chat",
    icon: MessagesSquare,
    title: "Messagerie du projet",
    text: "Boîte de réception en 3 colonnes, Instinct IA, reprise en main, notes internes, étiquettes.",
  },
  {
    href: "/maquettes/projects/demo/analytics",
    icon: BarChart3,
    title: "Analytique",
    text: "KPI avec tendances, volume, autonomie de l’IA, entonnoir Instinct IA, heures d’affluence.",
  },
  {
    href: "/maquettes/projects/demo/reports",
    icon: CalendarClock,
    title: "Rapports (aperçu de test)",
    text: "La page Rapports actuelle en offre Business, avec des rapports fictifs pour la tester.",
  },
  {
    href: "/maquettes/tarifs",
    icon: CreditCard,
    title: "Tarifs",
    live: "/tarifs",
    text: "Offres mensuelles, tableau comparatif accessible, FAQ facturation.",
  },
  {
    href: "/maquettes/connexion",
    icon: LogIn,
    title: "Connexion",
    live: "/sign-in",
    text: "Écran scindé, connexion Google et TikTok, formulaire validé (React Hook Form + Zod).",
  },
];

export default function MaquettesIndex() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-5xl px-4 py-10 sm:px-6 md:py-16">
      <div className="mb-12 flex items-center justify-between">
        <LogoIcon LogoClassName="w-6" className="gap-1.5" />
        <ModeToggle screen="desktop" />
      </div>
      <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
        Propositions UI/UX
      </p>
      <h1 className="text-4xl md:text-5xl">Maquettes ExtravertyAI</h1>
      <p className="mt-4 max-w-xl text-muted-foreground">
        Propositions d’interfaces. Celles marquées « En ligne » sont désormais
        les pages réelles de l’application ; les autres utilisent des données
        fictives.
      </p>
      <ul className="mt-12 grid gap-4 sm:grid-cols-2">
        {pages.map(({ href, icon: Icon, title, text, live }) => (
          <li key={href}>
            <Link
              href={href}
              className="group flex h-full flex-col rounded-2xl border bg-card p-6 outline-none transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-foreground/5 focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:hover:translate-y-0"
            >
              <span className="mb-8 flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-xl border bg-background">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <ArrowUpRight
                  aria-hidden="true"
                  className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                />
              </span>
              <span className="font-heading text-xl font-semibold">{title}</span>
              <span className="mt-2 text-sm text-muted-foreground">{text}</span>
              <span className="mt-4 flex flex-wrap items-center gap-2 font-mono text-xs text-muted-foreground">
                {href}
                {live && (
                  <span className="rounded-full bg-primary px-2 py-0.5 font-sans text-[10px] text-primary-foreground">
                    En ligne sur {live}
                  </span>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
