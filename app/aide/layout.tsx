import type { Metadata } from "next";
import Link from "next/link";

import { HelpHeader } from "@/components/help/help-header";
import { HelpSidebar } from "@/components/help/help-sidebar";
import { buildHelpSearchIndex, getHelpNavigation, getHelpSearchSuggestions } from "@/lib/help-center/articles";
import { HELP_DESCRIPTION } from "@/lib/help-center/content";
import { SITE_CONTACT, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: {
    default: `Centre d’aide | ${SITE_NAME}`,
    template: `%s | Aide ${SITE_NAME}`,
  },
  description: HELP_DESCRIPTION,
};

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  // Calculés au build : les pages d’aide sont statiques.
  const groups = getHelpNavigation();
  const searchIndex = buildHelpSearchIndex();
  const suggestions = getHelpSearchSuggestions(searchIndex);

  return (
    <div className="min-h-dvh bg-background">
      <HelpHeader groups={groups} searchIndex={searchIndex} suggestions={suggestions} />
      <div className="mx-auto flex w-full max-w-[90rem] gap-10 px-4 sm:px-6 lg:px-8">
        <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-64 shrink-0 overflow-y-auto py-8 pr-2 lg:block">
          <HelpSidebar groups={groups} />
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      <footer className="mt-16 border-t">
        <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>
            © {SITE_NAME} · Une question sans réponse ?{" "}
            <a
              href={SITE_CONTACT.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground underline underline-offset-4"
            >
              Écrivez-nous sur WhatsApp
            </a>
          </p>
          <nav aria-label="Liens du site" className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/" className="hover:text-foreground">
              Accueil
            </Link>
            <Link href="/#tarifs" className="hover:text-foreground">
              Tarifs
            </Link>
            <Link href="/conditions" className="hover:text-foreground">
              Conditions
            </Link>
            <Link href="/donneesEtConfidentialite" className="hover:text-foreground">
              Confidentialité
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
