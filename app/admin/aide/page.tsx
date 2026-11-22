import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Inbox, MessageSquareText, SearchX, ThumbsDown, ThumbsUp } from "lucide-react";

import { HelpFeedbackFilters } from "@/components/admin/help-feedback-filters";
import { formatHelpScore, HELP_STATUS_LABEL } from "@/components/admin/help-feedback-labels";
import { HelpFeedbackSheet, type HelpFeedbackSheetData } from "@/components/admin/help-feedback-sheet";
import { formatFeedbackDate } from "@/components/admin/feedback-labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminMetadata, requireAdminPage } from "@/lib/admin-auth";
import { getHelpArticle } from "@/lib/help-center/articles";
import { HELP_ARTICLES } from "@/lib/help-center/content";
import {
  HELP_FEEDBACK_REASON_LABEL,
  HELP_FEEDBACK_STATUSES,
  helpFeedbackFiltersToSearch,
  type HelpFeedbackFilters as Filters,
} from "@/lib/help-center/feedback-shared";
import { getHelpFeedbackDetail, HELP_FEEDBACK_PAGE_SIZE, listHelpFeedback, parseHelpFeedbackFilters } from "@/lib/help-feedback";
import prisma from "@/lib/prisma";
import { getUserTimeZone } from "@/lib/server-time-zone";
import { cn } from "@/lib/utils";

export function generateMetadata(): Promise<Metadata> {
  return adminMetadata("Avis sur l’aide");
}

const articleTitle = (slug: string) => getHelpArticle(slug)?.title ?? slug;

export default async function AdminHelpFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Revérifié ici : le layout ne protège pas les navigations côté client.
  await requireAdminPage();
  const params = await searchParams;
  const filters = parseHelpFeedbackFilters(params);
  const selectedId = typeof params.id === "string" ? params.id : undefined;
  const [list, detail, timeZone] = await Promise.all([
    listHelpFeedback(prisma, filters),
    selectedId ? getHelpFeedbackDetail(prisma, selectedId) : null,
    getUserTimeZone(),
  ]);
  const href = (patch: Partial<Filters> & { id?: string }) =>
    `/admin/aide${helpFeedbackFiltersToSearch({ ...filters, ...patch })}`;
  const sheetData: HelpFeedbackSheetData | null = detail && {
    id: detail.id,
    articleSlug: detail.articleSlug,
    articleTitle: articleTitle(detail.articleSlug),
    helpful: detail.helpful,
    reason: detail.reason,
    comment: detail.comment,
    status: detail.status,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
    author: detail.user ? { name: detail.user.name, email: detail.user.email } : null,
    handledAt: detail.handledAt,
    handledByName: detail.handledBy?.name ?? null,
    internalNote: detail.internalNote,
  };
  const pending = list.articles.reduce((sum, article) => sum + article.pending, 0);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs tracking-wider text-muted-foreground uppercase">Back-office · Centre d’aide</p>
          <h1 className="mt-1 text-3xl md:text-4xl">Avis sur l’aide</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Les votes « Cet article vous a-t-il aidé ? » de /aide. Traitez les avis négatifs, corrigez l’article,
            puis archivez-les ; chaque changement est journalisé.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/aide" target="_blank">
            Ouvrir le centre d’aide
            <span className="sr-only"> (nouvel onglet)</span>
          </Link>
        </Button>
      </header>

      <section aria-label="Indicateurs" className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-4">
        <Stat label="Satisfaction" value={formatHelpScore(list.totals.score)} hint="Part des votes « Oui »" />
        <Stat label="Utile" value={list.totals.up.toLocaleString("fr-FR")} icon={<ThumbsUp aria-hidden="true" className="size-3.5" />} />
        <Stat label="Pas utile" value={list.totals.down.toLocaleString("fr-FR")} icon={<ThumbsDown aria-hidden="true" className="size-3.5" />} />
        <Stat label="Avis négatifs à traiter" value={pending.toLocaleString("fr-FR")} />
      </section>

      <section aria-labelledby="help-articles-title" className="min-w-0">
        <h2 id="help-articles-title" className="text-lg! tracking-tight!">
          Par article
        </h2>
        {list.articles.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Aucun vote sur la période choisie.</p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-2xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Article</TableHead>
                  <TableHead className="w-48">Satisfaction</TableHead>
                  <TableHead className="hidden w-20 text-right sm:table-cell">Utile</TableHead>
                  <TableHead className="hidden w-24 text-right sm:table-cell">Pas utile</TableHead>
                  <TableHead className="w-28 pr-4 text-right">À traiter</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.articles.map((article) => (
                  <TableRow key={article.slug} data-state={filters.article === article.slug ? "selected" : undefined} className="relative">
                    <TableCell className="max-w-0 pl-4 whitespace-normal">
                      <Link
                        href={href({ article: article.slug, vote: "DOWN", page: 1 })}
                        scroll={false}
                        className="line-clamp-1 rounded-sm after:absolute after:inset-0 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                      >
                        {article.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <span aria-hidden="true" className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                          <span className="block h-full rounded-full bg-foreground" style={{ width: `${Math.round((article.score ?? 0) * 100)}%` }} />
                        </span>
                        <span className="text-sm tabular-nums">{formatHelpScore(article.score)}</span>
                      </span>
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{article.up}</TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{article.down}</TableCell>
                    <TableCell className="pr-4 text-right">
                      {article.pending > 0 ? <Badge>{article.pending}</Badge> : <span className="text-muted-foreground">0</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section aria-labelledby="help-feedback-title" className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="help-feedback-title" className="text-lg! tracking-tight!">
            Avis
          </h2>
          <ul className="flex flex-wrap gap-1.5 text-xs">
            {HELP_FEEDBACK_STATUSES.map((status) => (
              <li key={status}>
                <Link
                  href={href({ status, page: 1 })}
                  aria-current={filters.status === status ? "true" : undefined}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                    filters.status === status && "bg-muted text-foreground",
                  )}
                >
                  {HELP_STATUS_LABEL[status].plural}
                  <span className="tabular-nums text-muted-foreground">{list.statusCounts[status]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <HelpFeedbackFilters
          filters={filters}
          articles={HELP_ARTICLES.map((article) => ({ slug: article.slug, title: article.title }))}
        />

        {list.items.length === 0 ? (
          <Empty className="rounded-2xl border border-dashed p-10">
            <EmptyHeader>
              <EmptyMedia variant="icon">{list.totals.up + list.totals.down > 0 ? <SearchX aria-hidden="true" /> : <Inbox aria-hidden="true" />}</EmptyMedia>
              <EmptyTitle>{list.totals.up + list.totals.down > 0 ? "Aucun avis ne correspond" : "Aucun avis pour l’instant"}</EmptyTitle>
              <EmptyDescription>
                {list.totals.up + list.totals.down > 0
                  ? "Élargissez la période, changez de statut ou d’article."
                  : "Les votes laissés en bas des articles de /aide apparaîtront ici."}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild variant="outline">
                <Link href="/admin/aide?period=all&status=ALL">Voir tous les avis</Link>
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <>
            <div className="overflow-hidden rounded-2xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24 pl-4">Vote</TableHead>
                    <TableHead>Avis</TableHead>
                    <TableHead className="hidden md:table-cell">Statut</TableHead>
                    <TableHead className="w-36 pr-4 text-right">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.items.map((item) => {
                    const status = HELP_STATUS_LABEL[item.status];
                    return (
                      <TableRow key={item.id} data-state={item.id === selectedId ? "selected" : undefined} className="relative">
                        <TableCell className="pl-4 align-top">
                          <span className="inline-flex items-center gap-1.5 text-sm">
                            {item.helpful ? (
                              <ThumbsUp aria-hidden="true" className="size-4 text-muted-foreground" />
                            ) : (
                              <ThumbsDown aria-hidden="true" className="size-4 text-muted-foreground" />
                            )}
                            {item.helpful ? "Utile" : "Pas utile"}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-0 align-top whitespace-normal">
                          {/* Le lien couvre toute la ligne : clic ou clavier ouvrent le détail. */}
                          <Link
                            href={href({ id: item.id })}
                            scroll={false}
                            className="block rounded-sm font-medium after:absolute after:inset-0 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                          >
                            <span className="line-clamp-1">{articleTitle(item.articleSlug)}</span>
                          </Link>
                          {!item.helpful && (
                            <span className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
                              {item.comment && <MessageSquareText aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />}
                              <span className="line-clamp-2 break-words">
                                {item.reason ? HELP_FEEDBACK_REASON_LABEL[item.reason] : "Sans motif"}
                                {item.comment ? ` · ${item.comment}` : ""}
                              </span>
                            </span>
                          )}
                          <Badge variant={status.variant} className="mt-1.5 md:hidden">
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden align-top md:table-cell">
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </TableCell>
                        <TableCell className="pr-4 text-right align-top text-xs text-muted-foreground">
                          <time dateTime={item.updatedAt.toISOString()}>{formatFeedbackDate(item.updatedAt, timeZone)}</time>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <nav aria-label="Pagination des avis" className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
              <p>
                {(filters.page - 1) * HELP_FEEDBACK_PAGE_SIZE + 1}–{Math.min(filters.page * HELP_FEEDBACK_PAGE_SIZE, list.total)} sur{" "}
                {list.total.toLocaleString("fr-FR")}
              </p>
              <div className="flex gap-2">
                {filters.page > 1 ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={href({ page: filters.page - 1 })} scroll={false}>
                      <ChevronLeft data-icon="inline-start" />
                      Précédent
                    </Link>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" disabled>
                    <ChevronLeft data-icon="inline-start" />
                    Précédent
                  </Button>
                )}
                {filters.page < list.pageCount ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={href({ page: filters.page + 1 })} scroll={false}>
                      Suivant
                      <ChevronRight data-icon="inline-end" />
                    </Link>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" disabled>
                    Suivant
                    <ChevronRight data-icon="inline-end" />
                  </Button>
                )}
              </div>
            </nav>
          </>
        )}
      </section>

      {selectedId && (
        <HelpFeedbackSheet key={selectedId} feedback={sheetData} closeHref={href({ id: undefined })} timeZone={timeZone} />
      )}
    </div>
  );
}

function Stat({ label, value, hint, icon }: { label: string; value: string; hint?: string; icon?: React.ReactNode }) {
  return (
    <div className="min-w-0 bg-card px-4 py-3">
      <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-0.5 text-2xl font-medium tabular-nums">{value}</p>
      {hint && <p className="truncate text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
