"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowUpRight, FileText, ImageIcon, Loader2, MessageCircleReply, Mic, TriangleAlert, Video } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { getInitials } from "@/components/getInitials";
import { listRepliesAction } from "@/app/actions/broadcasts";
import type { ReplyRow } from "@/lib/broadcasts";

const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });

const MEDIA = {
  IMAGE: { icon: ImageIcon, label: "Image" },
  AUDIO: { icon: Mic, label: "Note vocale" },
  VIDEO: { icon: Video, label: "Vidéo" },
  DOCUMENT: { icon: FileText, label: "Document" },
} as const;

type Page = { rows: ReplyRow[]; nextCursor: string | null };

/** What customers answered, newest first; each reply opens its conversation. */
export function RepliesPanel({ projectId, broadcastId, initial }: { projectId: string; broadcastId: string; initial: Page }) {
  const [page, setPage] = useState<Page>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function loadMore() {
    if (!page.nextCursor) return;
    const cursor = page.nextCursor;
    startTransition(async () => {
      const result = await listRepliesAction({ projectId, broadcastId, cursor });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setError(null);
      setPage((current) => ({ rows: [...current.rows, ...result.rows], nextCursor: result.nextCursor }));
    });
  }

  if (!page.rows.length) {
    return (
      <Empty className="rounded-2xl border border-dashed p-10">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MessageCircleReply aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>Pas encore de réponse</EmptyTitle>
          <EmptyDescription>
            Les messages que vos clients envoient dans les 7 jours suivant la diffusion apparaissent ici.
            L’assistant et votre équipe y répondent depuis la messagerie, comme d’habitude.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-xl border border-destructive/40 p-3 text-sm text-destructive">
          <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
          {error}
        </p>
      )}
      <ul className="space-y-3">
        {page.rows.map((reply) => {
          const media = MEDIA[reply.type as keyof typeof MEDIA];
          const text = media && reply.content === `[${reply.type}]` ? "" : reply.content;
          return (
            <li key={reply.id}>
              <article className="flex gap-3 rounded-2xl border bg-card p-4">
                <span
                  aria-hidden="true"
                  className="flex size-9 shrink-0 items-center justify-center rounded-full border bg-muted/50 font-heading text-xs font-semibold"
                >
                  {getInitials(reply.contact.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <h3 className="truncate text-sm font-medium">{reply.contact.name}</h3>
                    <time dateTime={reply.createdAt} className="font-mono text-[11px] tabular-nums text-muted-foreground">
                      {dateTime.format(new Date(reply.createdAt))}
                    </time>
                  </header>
                  {media && (
                    <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <media.icon aria-hidden="true" className="size-3.5" />
                      {media.label}
                    </p>
                  )}
                  {text && (
                    <p dir="auto" className="mt-1.5 line-clamp-4 whitespace-pre-wrap wrap-anywhere text-sm leading-relaxed">
                      {text}
                    </p>
                  )}
                  <Link
                    href={`/projects/${projectId}/chat?contactId=${encodeURIComponent(reply.contact.id)}`}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium underline-offset-4 outline-none hover:underline focus-visible:underline"
                  >
                    Ouvrir la conversation
                    <ArrowUpRight aria-hidden="true" className="size-3.5" />
                  </Link>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
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
