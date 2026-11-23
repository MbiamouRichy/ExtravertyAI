import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarDays, ChevronRight, Clock3 } from "lucide-react";

import { HelpSectionView } from "@/components/help/help-blocks";
import { HelpFeedback } from "@/components/help/help-feedback";
import { HelpToc } from "@/components/help/help-toc";
import {
  formatHelpDate,
  getAdjacentHelpArticles,
  getHelpArticle,
  getHelpGroup,
  getHelpToc,
  helpArticleHref,
  helpReadingMinutes,
} from "@/lib/help-center/articles";
import { HELP_ARTICLES, HELP_UPDATED_AT } from "@/lib/help-center/content";
import { JsonLd } from "@/components/json-ld";
import { pageMetadata } from "@/lib/seo";
import { breadcrumbStructuredData, helpArticleStructuredData } from "@/lib/structured-data";

// Uniquement les articles connus : toute autre adresse renvoie une 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return HELP_ARTICLES.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const article = getHelpArticle((await params).slug);
  if (!article) return {};
  return pageMetadata({
    title: article.title,
    shareTitle: article.title,
    description: article.summary,
    path: helpArticleHref(article.slug),
    type: "article",
  });
}

export default async function HelpArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const article = getHelpArticle((await params).slug);
  if (!article) notFound();
  const group = getHelpGroup(article.groupId);
  const toc = getHelpToc(article);
  const { previous, next } = getAdjacentHelpArticles(article.slug);
  const path = helpArticleHref(article.slug);

  return (
    <div className="flex gap-10">
      <JsonLd
        data={breadcrumbStructuredData([
          { name: "Centre d’aide", path: "/aide" },
          { name: article.title, path },
        ])}
      />
      <JsonLd
        data={helpArticleStructuredData({
          title: article.title,
          summary: article.summary,
          path,
          dateModified: HELP_UPDATED_AT,
        })}
      />
      <main id="contenu" tabIndex={-1} className="min-w-0 max-w-3xl flex-1 py-8 outline-none sm:py-10">
        <nav aria-label="Fil d’Ariane" className="text-sm text-muted-foreground">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link href="/aide" className="hover:text-foreground">
                Aide
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight className="size-3.5" />
            </li>
            <li>{group.label}</li>
            <li aria-hidden="true" className="hidden sm:block">
              <ChevronRight className="size-3.5" />
            </li>
            <li aria-current="page" className="hidden truncate text-foreground sm:block">
              {article.title}
            </li>
          </ol>
        </nav>

        <header className="mt-5 border-b pb-8">
          <h1 className="text-4xl! leading-[1.05]! sm:text-5xl!">{article.title}</h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground">{article.summary}</p>
          <dl className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
            {article.plan && (
              <div>
                <dt className="sr-only">Offre</dt>
                <dd className="rounded-full border px-2 py-0.5 font-medium text-foreground">{article.plan}</dd>
              </div>
            )}
            {article.audience && (
              <div>
                <dt className="sr-only">Pour qui</dt>
                <dd>{article.audience}</dd>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <dt>
                <Clock3 aria-hidden="true" className="size-3.5" />
                <span className="sr-only">Temps de lecture</span>
              </dt>
              <dd>{helpReadingMinutes(article)} min de lecture</dd>
            </div>
            <div className="flex items-center gap-1.5">
              <dt>
                <CalendarDays aria-hidden="true" className="size-3.5" />
                <span className="sr-only">Dernière mise à jour</span>
              </dt>
              <dd>
                Mis à jour le <time dateTime={HELP_UPDATED_AT}>{formatHelpDate(HELP_UPDATED_AT)}</time>
              </dd>
            </div>
          </dl>
        </header>

        {/* Colonne bornée : un schéma large défile dans son cadre au lieu d’élargir la page. */}
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6">
          {article.sections.map((section) => (
            <HelpSectionView key={section.id} section={section} />
          ))}
        </div>

        <div className="mt-14">
          <HelpFeedback key={article.slug} articleSlug={article.slug} />
        </div>

        <nav aria-label="Articles voisins" className="mt-8 grid gap-3 sm:grid-cols-2">
          {previous ? (
            <Link
              href={helpArticleHref(previous.slug)}
              className="group flex flex-col gap-1 rounded-xl border p-4 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ArrowLeft aria-hidden="true" className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
                Précédent
              </span>
              <span className="text-sm font-medium">{previous.title}</span>
            </Link>
          ) : (
            <span aria-hidden="true" className="hidden sm:block" />
          )}
          {next && (
            <Link
              href={helpArticleHref(next.slug)}
              className="group flex flex-col items-end gap-1 rounded-xl border p-4 text-right outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                Suivant
                <ArrowRight aria-hidden="true" className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
              <span className="text-sm font-medium">{next.title}</span>
            </Link>
          )}
        </nav>
      </main>

      <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-56 shrink-0 overflow-y-auto py-10 xl:block">
        <HelpToc entries={toc} />
      </aside>
    </div>
  );
}
