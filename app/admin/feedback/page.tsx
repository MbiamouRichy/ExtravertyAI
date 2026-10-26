import type { Metadata } from "next";
import Link from "next/link";

import prisma from "@/lib/prisma";
import { adminMetadata, requireAdminPage } from "@/lib/admin-auth";
import { getUserTimeZone } from "@/lib/server-time-zone";
import {
  FEEDBACK_KINDS,
  FEEDBACK_STATUSES,
  feedbackFiltersToSearch,
  getFeedbackDetail,
  listFeedback,
  parseFeedbackFilters,
} from "@/lib/admin-feedback";
import { KIND_LABEL, STATUS_LABEL } from "@/components/admin/feedback-labels";
import { FeedbackFilters } from "@/components/admin/feedback-filters";
import { FeedbackTable } from "@/components/admin/feedback-table";
import { FeedbackDetailSheet } from "@/components/admin/feedback-detail-sheet";
import { cn } from "@/lib/utils";

export function generateMetadata(): Promise<Metadata> {
  return adminMetadata("Retours produit");
}

export default async function AdminFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Revérifié ici : le layout ne protège pas les navigations côté client.
  await requireAdminPage();
  const params = await searchParams;
  const filters = parseFeedbackFilters(params);
  const selectedId = typeof params.id === "string" ? params.id : undefined;
  const [list, detail, timeZone] = await Promise.all([
    listFeedback(prisma, filters),
    selectedId ? getFeedbackDetail(prisma, selectedId) : null,
    getUserTimeZone(),
  ]);
  const scopeTotal = Object.values(list.kindCounts).reduce((a, b) => a + b, 0);
  const closeHref = `/admin/feedback${feedbackFiltersToSearch(filters)}`;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header>
        <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Back-office · Produit
        </p>
        <h1 className="mt-1 text-3xl md:text-4xl">Retours des utilisateurs</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Bugs, idées et compliments envoyés depuis le bouton « Votre avis ».
          Passez-les en cours, traitez-les ou archivez-les ; chaque changement
          est journalisé.
        </p>
      </header>

      <section aria-label="Compteurs" className="grid gap-3 lg:grid-cols-2">
        <CounterGroup
          title="Par statut"
          items={FEEDBACK_STATUSES.map((status) => ({
            key: status,
            label: STATUS_LABEL[status].plural,
            count: list.statusCounts[status],
            active: filters.status === status,
            href: `/admin/feedback${feedbackFiltersToSearch({ ...filters, status, page: 1 })}`,
          }))}
        />
        <CounterGroup
          title="Par type"
          items={FEEDBACK_KINDS.map((kind) => ({
            key: kind,
            label: KIND_LABEL[kind].plural,
            count: list.kindCounts[kind],
            active: filters.kind === kind,
            href: `/admin/feedback${feedbackFiltersToSearch({ ...filters, kind, page: 1 })}`,
          }))}
        />
      </section>

      <FeedbackFilters filters={filters} />

      <FeedbackTable
        items={list.items}
        filters={filters}
        total={list.total}
        pageCount={list.pageCount}
        scopeTotal={scopeTotal}
        timeZone={timeZone}
        selectedId={selectedId}
      />

      {selectedId && (
        <FeedbackDetailSheet
          key={selectedId}
          feedback={detail}
          closeHref={closeHref}
          timeZone={timeZone}
        />
      )}
    </div>
  );
}

function CounterGroup({
  title,
  items,
}: {
  title: string;
  items: { key: string; label: string; count: number; active: boolean; href: string }[];
}) {
  return (
    <div className="min-w-0 rounded-2xl border bg-card">
      <h2 className="px-4 pt-3 text-xs font-medium text-muted-foreground">{title}</h2>
      <ul
        className={cn(
          "grid divide-x",
          items.length === 4 ? "grid-cols-4" : "grid-cols-3",
        )}
      >
        {items.map((item) => (
          <li key={item.key} className="min-w-0">
            <Link
              href={item.href}
              aria-current={item.active ? "true" : undefined}
              className={cn(
                "block rounded-xl px-3 pt-1 pb-3 transition-colors hover:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none sm:px-4",
                item.active && "bg-muted/60",
              )}
            >
              <span className="block truncate text-xs text-muted-foreground">
                {item.label}
              </span>
              <span className="block text-2xl font-medium tabular-nums">
                {item.count.toLocaleString("fr-FR")}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
