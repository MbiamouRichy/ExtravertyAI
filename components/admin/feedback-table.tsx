import Link from "next/link";
import { ChevronLeft, ChevronRight, Inbox, SearchX } from "lucide-react";

import {
  FEEDBACK_PAGE_SIZE,
  feedbackFiltersToSearch,
  type FeedbackFilters,
  type FeedbackListItem,
} from "@/lib/admin-feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { KIND_LABEL, STATUS_LABEL, formatFeedbackDate } from "./feedback-labels";


export function FeedbackTable({
  items,
  filters,
  total,
  pageCount,
  scopeTotal,
  timeZone,
  selectedId,
}: {
  items: FeedbackListItem[];
  filters: FeedbackFilters;
  total: number;
  pageCount: number;
  scopeTotal: number;
  timeZone: string;
  selectedId?: string;
}) {
  const href = (patch: Partial<FeedbackFilters> & { id?: string }) =>
    `/admin/feedback${feedbackFiltersToSearch({ ...filters, ...patch })}`;

  if (!items.length) {
    const filtered = scopeTotal > 0 || filters.q || filters.period !== "all";
    return (
      <Empty className="rounded-2xl border border-dashed p-10">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            {filtered ? <SearchX aria-hidden="true" /> : <Inbox aria-hidden="true" />}
          </EmptyMedia>
          <EmptyTitle>
            {filtered ? "Aucun retour ne correspond" : "Aucun retour pour l’instant"}
          </EmptyTitle>
          <EmptyDescription>
            {filtered
              ? "Élargissez la période, changez de statut ou effacez la recherche."
              : "Les messages envoyés depuis le bouton « Votre avis » apparaîtront ici."}
          </EmptyDescription>
        </EmptyHeader>
        {filtered && (
          <EmptyContent>
            <Button asChild variant="outline">
              <Link href="/admin/feedback">Effacer les filtres</Link>
            </Button>
          </EmptyContent>
        )}
      </Empty>
    );
  }

  const first = (filters.page - 1) * FEEDBACK_PAGE_SIZE + 1;
  return (
    <section aria-labelledby="feedback-results" className="min-w-0">
      <h2 id="feedback-results" className="sr-only">
        Résultats
      </h2>
      <div className="overflow-hidden rounded-2xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28 pl-4">Type</TableHead>
              <TableHead>Message</TableHead>
              <TableHead className="hidden lg:table-cell">Auteur</TableHead>
              <TableHead className="hidden md:table-cell">Statut</TableHead>
              <TableHead className="w-32 pr-4 text-right">
                <Link
                  href={href({ sort: filters.sort === "desc" ? "asc" : "desc", page: 1 })}
                  className="rounded-sm underline-offset-4 hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                  aria-label={
                    filters.sort === "desc"
                      ? "Date, du plus récent au plus ancien. Inverser le tri"
                      : "Date, du plus ancien au plus récent. Inverser le tri"
                  }
                >
                  Date {filters.sort === "desc" ? "↓" : "↑"}
                </Link>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const kind = KIND_LABEL[item.kind];
              const status = STATUS_LABEL[item.status];
              return (
                <TableRow
                  key={item.id}
                  data-state={item.id === selectedId ? "selected" : undefined}
                  className="relative"
                >
                  <TableCell className="pl-4 align-top">
                    <span className="inline-flex items-center gap-1.5 text-sm">
                      <kind.icon aria-hidden="true" className="size-4 text-muted-foreground" />
                      {kind.label}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-0 align-top whitespace-normal">
                    {/* Le lien couvre toute la ligne : clic ou clavier ouvrent le détail. */}
                    <Link
                      href={href({ id: item.id })}
                      scroll={false}
                      className="line-clamp-2 rounded-sm break-words after:absolute after:inset-0 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      {item.message}
                    </Link>
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground lg:hidden">
                      <span className="truncate">{item.user?.name ?? "Compte supprimé"}</span>
                      <Badge variant={status.variant} className="md:hidden">
                        {status.label}
                      </Badge>
                    </span>
                  </TableCell>
                  <TableCell className="hidden max-w-56 align-top lg:table-cell">
                    <span className="block truncate text-sm">
                      {item.user?.name ?? "Compte supprimé"}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {item.project?.name ?? "Sans projet"}
                    </span>
                  </TableCell>
                  <TableCell className="hidden align-top md:table-cell">
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </TableCell>
                  <TableCell className="pr-4 text-right align-top text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                    <time dateTime={item.createdAt.toISOString()}>
                      {formatFeedbackDate(item.createdAt, timeZone)}
                    </time>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <nav
        aria-label="Pagination"
        className="mt-3 flex flex-col items-center justify-between gap-2 text-sm text-muted-foreground sm:flex-row"
      >
        <p aria-live="polite">
          {first.toLocaleString("fr-FR")}–
          {(first + items.length - 1).toLocaleString("fr-FR")} sur{" "}
          {total.toLocaleString("fr-FR")} retour{total > 1 ? "s" : ""}
        </p>
        {pageCount > 1 && (
          <div className="flex items-center gap-2">
            <PageLink
              href={href({ page: filters.page - 1 })}
              disabled={filters.page <= 1}
              label="Page précédente"
            >
              <ChevronLeft data-icon="inline-start" />
              Précédente
            </PageLink>
            <span className="tabular-nums">
              {filters.page} / {pageCount}
            </span>
            <PageLink
              href={href({ page: filters.page + 1 })}
              disabled={filters.page >= pageCount}
              label="Page suivante"
            >
              Suivante
              <ChevronRight data-icon="inline-end" />
            </PageLink>
          </div>
        )}
      </nav>
    </section>
  );
}

function PageLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  if (disabled)
    return (
      <Button variant="outline" size="sm" disabled aria-label={label}>
        {children}
      </Button>
    );
  return (
    <Button asChild variant="outline" size="sm">
      <Link href={href} aria-label={label}>
        {children}
      </Link>
    </Button>
  );
}
