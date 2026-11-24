import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock3, FileText, MessageCircle } from "lucide-react";

import { HelpSearch } from "@/components/help/help-search";
import { Button } from "@/components/ui/button";
import {
  buildHelpSearchIndex,
  getHelpArticle,
  getHelpNavigation,
  getHelpSearchSuggestions,
  HELP_GUIDE_SLUG,
  helpArticleHref,
  helpReadingMinutes,
} from "@/lib/help-center/articles";
import { HELP_DESCRIPTION, SUPPORT_WHATSAPP_DISPLAY } from "@/lib/help-center/content";
import { JsonLd } from "@/components/json-ld";
import { pageMetadata } from "@/lib/seo";
import { SITE_CONTACT } from "@/lib/site";
import { breadcrumbStructuredData } from "@/lib/structured-data";

// Le titre vient du layout (`title.default`).
export const metadata: Metadata = pageMetadata({
  shareTitle: "Centre d’aide ExtravertyAI",
  description: HELP_DESCRIPTION,
  path: "/aide",
});

export default function HelpHomePage() {
  const guide = getHelpArticle(HELP_GUIDE_SLUG)!;
  const steps = guide.sections.filter((section) => section.step);
  const groups = getHelpNavigation();
  const searchIndex = buildHelpSearchIndex();
  const suggestions = getHelpSearchSuggestions(searchIndex);

  return (
    <main id="contenu" tabIndex={-1} className="mx-auto max-w-4xl py-10 outline-none sm:py-14">
      <JsonLd data={breadcrumbStructuredData([{ name: "Centre d’aide", path: "/aide" }])} />
      <header className="max-w-2xl">
        <p className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">Centre d’aide</p>
        <h1 className="mt-3 text-4xl! leading-[1.05]! sm:text-5xl!">Comment pouvons-nous vous aider ?</h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          Des guides pas à pas pour mettre votre assistant WhatsApp en ligne, l’enrichir et le piloter avec votre équipe.
        </p>
        <div className="mt-6">
          <HelpSearch index={searchIndex} suggestions={suggestions} variant="hero" />
        </div>
      </header>

      <section aria-labelledby="guide-title" className="mt-12 overflow-hidden rounded-2xl border">
        <div className="grid gap-6 p-5 sm:p-7 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:items-center">
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock3 aria-hidden="true" className="size-3.5" />
              {helpReadingMinutes(guide)} min de lecture · une quinzaine de minutes pour tout faire
            </p>
            <h2 id="guide-title" className="mt-2 text-2xl tracking-tight md:text-[1.75rem]">
              {guide.title}
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{guide.summary}</p>
            <Button asChild className="mt-5 group">
              <Link href={helpArticleHref(guide.slug)}>
                Lire le guide
                <ArrowRight data-icon="inline-end" className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Button>
          </div>
          <ol className="grid gap-1.5">
            {steps.map((section) => (
              <li key={section.id}>
                <Link
                  href={helpArticleHref(guide.slug, section.id)}
                  className="group flex items-center gap-3 rounded-xl border bg-background px-3 py-2.5 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground font-mono text-xs font-semibold text-background">
                    {section.step!.number}
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-medium">{section.title}</span>
                  <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{section.step!.duration}</span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="rubriques-title" className="mt-14">
        <h2 id="rubriques-title" className="text-2xl tracking-tight">
          Toutes les rubriques
        </h2>
        <div className="mt-6 grid gap-x-8 gap-y-10 sm:grid-cols-2">
          {groups.map((group) => (
            <section key={group.id} aria-labelledby={`rubrique-${group.id}`}>
              <h3 id={`rubrique-${group.id}`} className="text-lg! tracking-tight!">
                {group.label}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">{group.description}</p>
              <ul className="mt-3 grid gap-0.5">
                {group.articles.map((article) => (
                  <li key={article.slug}>
                    <Link
                      href={helpArticleHref(article.slug)}
                      className="group -mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <FileText aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">{article.title}</span>
                      {article.plan && (
                        <span className="shrink-0 rounded-full border px-1.5 text-[10px] text-muted-foreground">
                          {article.plan}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </section>

      <section
        aria-labelledby="contact-title"
        className="mt-14 flex flex-col gap-4 rounded-2xl border bg-muted/30 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
      >
        <div className="flex items-start gap-3">
          <MessageCircle aria-hidden="true" className="mt-1 size-5 shrink-0" />
          <div>
            <h2 id="contact-title" className="text-lg! tracking-tight!">
              Vous ne trouvez pas votre réponse ?
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              L’équipe vous répond sur WhatsApp au {SUPPORT_WHATSAPP_DISPLAY}. Précisez le nom de votre projet.
            </p>
          </div>
        </div>
        <Button asChild variant="outline" className="shrink-0">
          <a href={SITE_CONTACT.whatsapp} target="_blank" rel="noopener noreferrer">
            Écrire à l’équipe
            <span className="sr-only"> (WhatsApp, nouvel onglet)</span>
          </a>
        </Button>
      </section>
    </main>
  );
}
