"use client";

import { LocalDate } from "@/components/local-date";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  Ban,
  Check,
  CheckCheck,
  Clock3,
  Loader2,
  Reply,
  Search,
  TriangleAlert,
  UsersRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { listRecipientsAction } from "@/app/actions/broadcasts";
import { BROADCAST_SKIP_LABEL, RECIPIENT_FILTERS, type RecipientFilter } from "@/lib/broadcast-shared";
import type { RecipientRow } from "@/lib/broadcasts";
import { cn } from "@/lib/utils";

const dateTime = { dateStyle: "short", timeStyle: "short" } as const;

function stateOf(row: RecipientRow) {
  if (row.state === "PENDING") return { label: "En attente", icon: Clock3, tone: "text-muted-foreground" };
  if (row.state === "SKIPPED") {
    return { label: BROADCAST_SKIP_LABEL[row.skipReason ?? ""] ?? "Ignoré", icon: Ban, tone: "text-muted-foreground" };
  }
  switch (row.messageStatus) {
    case "PENDING":
      return { label: "En file d’envoi", icon: Clock3, tone: "text-muted-foreground" };
    case "SENT":
      return { label: "Envoyé", icon: Check, tone: "" };
    case "DELIVERED":
      return { label: "Distribué", icon: CheckCheck, tone: "" };
    case "READ":
      return { label: "Lu", icon: CheckCheck, tone: "font-medium" };
    case "FAILED":
      return { label: "Échec d’envoi", icon: TriangleAlert, tone: "text-destructive" };
    default:
      return { label: "Message supprimé", icon: Ban, tone: "text-muted-foreground" };
  }
}

type Page = { rows: RecipientRow[]; nextCursor: string | null };

export function RecipientsPanel({
  projectId,
  broadcastId,
  counts,
  initial,
}: {
  projectId: string;
  broadcastId: string;
  counts: Record<RecipientFilter, number>;
  initial: Page;
}) {
  const [filter, setFilter] = useState<RecipientFilter>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState<Page>(initial);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();
  const [appending, startAppending] = useTransition();
  const first = useRef(true);

  // New filter or search: first page again, a moment after typing stops.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = setTimeout(() => {
      startLoading(async () => {
        const result = await listRecipientsAction({ projectId, broadcastId, filter, query, cursor: null });
        if (!result.success) {
          setError(result.error);
          return;
        }
        setError(null);
        setPage({ rows: result.rows, nextCursor: result.nextCursor });
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [projectId, broadcastId, filter, query]);

  function loadMore() {
    if (!page.nextCursor) return;
    const cursor = page.nextCursor;
    startAppending(async () => {
      const result = await listRecipientsAction({ projectId, broadcastId, filter, query, cursor });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setPage((current) => ({ rows: [...current.rows, ...result.rows], nextCursor: result.nextCursor }));
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div role="group" aria-label="Filtrer les destinataires" className="-mx-1 flex flex-wrap gap-1.5 px-1">
          {RECIPIENT_FILTERS.map((option) => (
            <Button
              key={option.id}
              type="button"
              size="sm"
              variant={filter === option.id ? "default" : "outline"}
              aria-pressed={filter === option.id}
              onClick={() => setFilter(option.id)}
              className="h-8"
            >
              {option.label}
              <span className="font-mono text-[11px] tabular-nums opacity-70">
                {counts[option.id].toLocaleString("fr-FR")}
              </span>
            </Button>
          ))}
        </div>
        <InputGroup className="lg:max-w-64">
          <InputGroupAddon>
            {loading ? <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : <Search aria-hidden="true" />}
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            value={query}
            maxLength={60}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher un nom"
            aria-label="Rechercher un destinataire par son nom"
            autoComplete="off"
          />
        </InputGroup>
      </div>

      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-xl border border-destructive/40 p-3 text-sm text-destructive">
          <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
          {error}
        </p>
      )}

      {page.rows.length ? (
        <ul aria-busy={loading} className={cn("divide-y rounded-2xl border bg-card transition-opacity", loading && "opacity-60")}>
          {page.rows.map((row) => {
            const state = stateOf(row);
            return (
              <li key={row.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-4 sm:px-4">
                <div className="min-w-0 flex-1">
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
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                  <span className={cn("inline-flex items-center gap-1.5", state.tone)}>
                    <state.icon aria-hidden="true" className="size-3.5" />
                    {state.label}
                  </span>
                  {row.replied && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5">
                      <Reply aria-hidden="true" className="size-3" />
                      A répondu
                    </span>
                  )}
                  <span className="w-24 font-mono text-[11px] tabular-nums text-muted-foreground sm:text-right">
                    {row.queuedAt ? <LocalDate value={row.queuedAt} options={dateTime} /> : "—"}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty className="rounded-2xl border border-dashed p-8">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UsersRound aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle className="text-sm">{query ? "Aucun nom ne correspond" : "Personne dans cette catégorie"}</EmptyTitle>
            <EmptyDescription>
              {query ? "Vérifiez l’orthographe ou essayez un autre filtre." : "Les destinataires apparaîtront ici au fil de l’envoi."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {page.nextCursor && (
        <div className="flex justify-center">
          <Button type="button" variant="outline" disabled={appending} onClick={loadMore}>
            {appending && <Loader2 data-icon="inline-start" className="animate-spin motion-reduce:animate-none" />}
            Afficher plus
          </Button>
        </div>
      )}
    </div>
  );
}
