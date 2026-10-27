"use client";

import { LocalDate } from "@/components/local-date";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Loader2, ShieldCheck, TriangleAlert, UserX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { listOptedOutAction } from "@/app/actions/broadcasts";
import type { OptOutRow } from "@/lib/broadcasts";

const date = { dateStyle: "medium", timeStyle: "short" } as const;

type Page = { rows: OptOutRow[]; nextCursor: string | null };

/**
 * Contacts who answered STOP. Read-only on purpose: consent can only come back
 * from the customer (by writing START), never from the team.
 */
export function OptedOutPanel({ projectId, total, initial }: { projectId: string; total: number; initial: Page }) {
  const [page, setPage] = useState<Page>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function loadMore() {
    if (!page.nextCursor) return;
    const cursor = page.nextCursor;
    startTransition(async () => {
      const result = await listOptedOutAction({ projectId, cursor });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setError(null);
      setPage((current) => ({ rows: [...current.rows, ...result.rows], nextCursor: result.nextCursor }));
    });
  }

  return (
    <div className="space-y-4">
      <p className="flex items-start gap-2 rounded-xl border bg-muted/30 p-3 text-sm text-muted-foreground">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-foreground" />
        <span>
          {total.toLocaleString("fr-FR")} contact{total > 1 ? "s ont" : " a"} répondu STOP : exclu{total > 1 ? "s" : ""} de
          toutes les diffusions. Seul le client peut se réinscrire, en écrivant START. Les conversations restent ouvertes
          normalement.
        </span>
      </p>
      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-xl border border-destructive/40 p-3 text-sm text-destructive">
          <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
          {error}
        </p>
      )}
      {page.rows.length ? (
        <ul className="divide-y rounded-2xl border bg-card">
          {page.rows.map((row) => (
            <li key={row.contact.id} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
              <div className="min-w-0">
                <Link
                  href={`/projects/${projectId}/chat?contactId=${encodeURIComponent(row.contact.id)}`}
                  className="block truncate text-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:underline"
                >
                  {row.contact.name}
                </Link>
                {row.contact.maskedPhone && (
                  <span className="block font-mono text-[11px] text-muted-foreground">{row.contact.maskedPhone}</span>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                Désinscrit le <LocalDate value={row.optedOutAt} options={date} />
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <Empty className="rounded-2xl border border-dashed p-10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UserX aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>Aucun désinscrit</EmptyTitle>
            <EmptyDescription>Les contacts qui répondent STOP à une diffusion apparaîtront ici.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      {page.nextCursor && (
        <div className="flex justify-center">
          <Button type="button" variant="outline" disabled={pending} onClick={loadMore}>
            {pending && <Loader2 data-icon="inline-start" className="animate-spin motion-reduce:animate-none" />}
            Afficher plus
          </Button>
        </div>
      )}
    </div>
  );
}
