"use client";

import { LocalDate } from "@/components/local-date";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";
import { ChevronRight, CircleAlert, Clock3, ImageIcon, Megaphone, Plus, WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { useChatRealtime } from "@/hooks/use-chat-data";
import {
  BROADCAST_REASON_LABEL,
  BROADCAST_STATUS_LABEL,
  BROADCAST_WINDOW,
} from "@/lib/broadcast-shared";
import { cn } from "@/lib/utils";
import { BroadcastActions } from "./broadcast-actions";
import type { BroadcastStats } from "@/lib/broadcasts";
import { ACTIVE_STATUSES, type BroadcastStatus, type BroadcastUsageView, type BroadcastView } from "./types";

const number = (value: number) => value.toLocaleString("fr-FR");
const dateTime = { dateStyle: "medium", timeStyle: "short" } as const;

function Meter({ label, used, limit, hint }: { label: string; used: number; limit: number; hint?: string }) {
  const ratio = limit ? Math.min(1, used / limit) : 0;
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono tabular-nums">
          {number(used)} / {number(limit)}
        </span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={used}
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-foreground transition-[width]" style={{ width: `${ratio * 100}%` }} />
      </div>
      {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function StatusLabel({ status }: { status: BroadcastStatus }) {
  const tone =
    status === "PAUSED"
      ? "text-destructive"
      : status === "SENDING"
        ? "font-medium text-foreground"
        : "text-muted-foreground";
  return (
    <span className={cn("inline-flex w-fit items-center gap-1.5 text-xs", tone)}>
      <span
        aria-hidden="true"
        className={cn("size-1.5 rounded-full bg-current", status === "SENDING" && "animate-pulse motion-reduce:animate-none")}
      />
      {BROADCAST_STATUS_LABEL[status]}
    </span>
  );
}

function StatusReason({ status, reason, className }: { status: BroadcastStatus; reason: string; className?: string }) {
  return (
    <span
      className={cn(
        "flex items-start gap-1 text-xs",
        status === "PAUSED" ? "text-destructive" : "text-muted-foreground",
        className,
      )}
    >
      {status === "PAUSED" ? (
        <CircleAlert aria-hidden="true" className="mt-0.5 size-3 shrink-0" />
      ) : (
        <Clock3 aria-hidden="true" className="mt-0.5 size-3 shrink-0" />
      )}
      {reason}
    </span>
  );
}

export function StatusLine({ broadcast }: { broadcast: Pick<BroadcastView, "status" | "pauseReason" | "nextSendAt" | "scheduledAt"> }) {
  const reason = broadcast.pauseReason ? BROADCAST_REASON_LABEL[broadcast.pauseReason] : null;
  return (
    <div className="flex flex-col gap-1">
      <StatusLabel status={broadcast.status} />
      {broadcast.status === "SCHEDULED" && !reason && (
        <span className="text-xs text-muted-foreground">Départ prévu le <LocalDate value={broadcast.scheduledAt} options={dateTime} /></span>
      )}
      {reason && <StatusReason status={broadcast.status} reason={reason} />}
    </div>
  );
}

/** The date that matters for the status; its meaning is spelled out for screen readers. */
function ListDate({ broadcast }: { broadcast: BroadcastView }) {
  const [label, value] =
    broadcast.status === "SCHEDULED"
      ? ["départ prévu le", broadcast.scheduledAt]
      : broadcast.status === "COMPLETED"
        ? ["terminée le", broadcast.finishedAt ?? broadcast.createdAt]
        : broadcast.status === "CANCELLED"
          ? ["annulée le", broadcast.finishedAt ?? broadcast.createdAt]
          : ["lancée le", broadcast.startedAt ?? broadcast.scheduledAt];
  // The year only when it is not the current one.
  const options: Intl.DateTimeFormatOptions =
    new Date(value).getFullYear() === new Date().getFullYear()
      ? { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }
      : { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" };
  return (
    <span className="whitespace-nowrap">
      <span className="sr-only">{label} </span>
      <LocalDate value={value} options={options} />
    </span>
  );
}

/**
 * Key results of a broadcast in the list: inline on narrow cards, aligned
 * columns on wide ones. Failures only show on phones when there are some.
 */
function BroadcastSummary({ stats }: { stats: BroadcastStats | null }) {
  if (!stats) return null;
  const failed = stats.failed + stats.skipped;
  if (!stats.queued && !failed) return null;
  const rate = (value: number) => (stats.queued ? `${Math.round((value / stats.queued) * 100)} %` : "—");
  const items = [
    { label: "distribués", value: rate(stats.delivered), alert: false, optional: false },
    { label: "lus", value: rate(stats.read), alert: false, optional: false },
    { label: stats.replied > 1 ? "réponses" : "réponse", value: number(stats.replied), alert: false, optional: false },
    { label: failed > 1 ? "échecs" : "échec", value: number(failed), alert: failed > 0, optional: failed === 0 },
  ];
  return (
    <dl className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs @3xl/broadcast:flex-nowrap">
      {items.map((item) => (
        <div
          key={item.label}
          className={cn(
            "flex flex-row-reverse items-baseline gap-1 whitespace-nowrap",
            "@3xl/broadcast:w-20 @3xl/broadcast:flex-col-reverse @3xl/broadcast:items-end @3xl/broadcast:gap-0.5",
            item.optional && "@max-3xl/broadcast:hidden",
            item.alert ? "text-destructive" : "text-muted-foreground",
          )}
        >
          <dt className="@3xl/broadcast:capitalize">{item.label}</dt>
          <dd
            className={cn(
              "font-medium tabular-nums @3xl/broadcast:text-sm @3xl/broadcast:font-semibold",
              !item.alert && !item.optional && "text-foreground",
            )}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Chevron({ className }: { className?: string }) {
  return (
    <ChevronRight
      aria-hidden="true"
      className={cn(
        "size-4 shrink-0 text-muted-foreground transition-transform group-hover/broadcast:translate-x-0.5 group-hover/broadcast:text-foreground motion-reduce:transition-none",
        className,
      )}
    />
  );
}

export function BroadcastProgress({ broadcast }: { broadcast: BroadcastView }) {
  const stats = broadcast.stats;
  const done = stats ? stats.queued + stats.skipped : 0;
  const ratio = broadcast.recipientCount ? done / broadcast.recipientCount : 0;
  return (
    <div>
      <div
        role="progressbar"
        aria-label={`Progression de « ${broadcast.name} »`}
        aria-valuemin={0}
        aria-valuemax={broadcast.recipientCount}
        aria-valuenow={done}
        className="h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-foreground transition-[width]" style={{ width: `${ratio * 100}%` }} />
      </div>
      <p className="mt-1.5 text-xs tabular-nums text-muted-foreground">
        {number(done)} / {number(broadcast.recipientCount)} traités
      </p>
    </div>
  );
}

export function BroadcastKpis({ broadcast, size = "sm" }: { broadcast: BroadcastView; size?: "sm" | "lg" }) {
  const stats = broadcast.stats;
  const base = stats?.queued || 0;
  const rate = (value: number) => (base ? `${Math.round((value / base) * 100)} %` : "");
  const items = [
    { label: "Envoyés", value: stats?.sent ?? 0, extra: "" },
    { label: "Distribués", value: stats?.delivered ?? 0, extra: rate(stats?.delivered ?? 0) },
    { label: "Lus", value: stats?.read ?? 0, extra: rate(stats?.read ?? 0) },
    { label: "Réponses", value: stats?.replied ?? 0, extra: rate(stats?.replied ?? 0) },
    { label: "Échecs", value: (stats?.failed ?? 0) + (stats?.skipped ?? 0), extra: "" },
  ];
  return (
    <dl
      className={cn(
        "grid",
        size === "lg"
          ? "grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-5"
          : "grid-cols-3 gap-x-4 gap-y-3 sm:grid-cols-5",
      )}
    >
      {items.map((item) => (
        <div
          key={item.label}
          className={cn(
            "flex min-w-0 flex-col-reverse gap-0.5",
            size === "lg" && "bg-card p-3 last:col-span-2 sm:p-4 sm:last:col-span-1",
          )}
        >
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className={cn("font-semibold tabular-nums", size === "lg" ? "text-2xl tracking-tight" : "text-sm")}>
            {number(item.value)}
            {item.extra && (
              <span className="ml-1.5 text-xs font-normal tracking-normal text-muted-foreground">{item.extra}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function BroadcastsWorkspace({
  projectId,
  canManage,
  canCreate,
  connected,
  broadcasts,
  usage,
}: {
  projectId: string;
  canManage: boolean;
  /** Manager on a plan that includes broadcasts. */
  canCreate: boolean;
  connected: boolean;
  broadcasts: BroadcastView[];
  usage: BroadcastUsageView;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const refresh = useCallback(() => startTransition(() => router.refresh()), [router]);
  // Progress is pushed by the worker on the project channel.
  useChatRealtime(projectId, refresh);
  const base = `/projects/${projectId}/broadcasts`;

  return (
    <div className="space-y-4">
      <section aria-label="Utilisation" className="rounded-xl border bg-card p-4">
        <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          <Meter
            label="Messages de diffusion ce mois-ci"
            used={usage.monthly.used}
            limit={usage.monthly.limit}
            hint={usage.monthly.reserved ? `${number(usage.monthly.reserved)} encore prévus dans la diffusion en cours.` : undefined}
          />
          <Meter label="Aujourd’hui" used={usage.daily.used} limit={usage.daily.limit} />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Jusqu’à <span className="text-foreground">{number(usage.recipientsLimit)} contacts</span> par diffusion,
          envoyés entre {BROADCAST_WINDOW.startHour} h et {BROADCAST_WINDOW.endHour} h (heure de votre activité, {usage.sendingZone}), au
          rythme d’un message toutes les 8 à 15 secondes pour protéger votre numéro.
        </p>
      </section>

      {!connected && (
        // Icon inline with the text: wrapped lines use the full width, not a column beside it.
        <p role="status" className="rounded-xl border border-destructive/40 p-3 text-sm text-pretty text-destructive">
          <WifiOff aria-hidden="true" className="mr-2 inline-block size-4 align-[-0.2em]" />
          WhatsApp n’est pas connecté : les diffusions attendent sa reconnexion pour partir.
        </p>
      )}

      {broadcasts.length ? (
        <ul aria-label="Vos diffusions" className="divide-y rounded-xl border bg-card">
          {broadcasts.map((broadcast) => {
            const active = ACTIVE_STATUSES.includes(broadcast.status);
            const reason = broadcast.pauseReason ? BROADCAST_REASON_LABEL[broadcast.pauseReason] : null;
            return (
              // The whole card opens the detail: the title link covers it, the actions sit above.
              <li
                key={broadcast.id}
                className="group/broadcast @container/broadcast relative p-4 transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-muted/40 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring has-[a:focus-visible]:ring-inset motion-reduce:transition-none"
              >
                <div className="flex flex-col gap-3 @3xl/broadcast:flex-row @3xl/broadcast:items-center @3xl/broadcast:gap-6">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
                        <Link href={`${base}/${broadcast.id}`} className="truncate outline-none after:absolute after:inset-0">
                          {broadcast.name}
                        </Link>
                        {broadcast.hasImage && (
                          <ImageIcon role="img" aria-label="Avec image" className="size-3.5 shrink-0 text-muted-foreground" />
                        )}
                      </h3>
                      <Chevron className="ml-auto @3xl/broadcast:hidden" />
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <StatusLabel status={broadcast.status} />
                      <span>
                        {number(broadcast.recipientCount)} contact{broadcast.recipientCount > 1 ? "s" : ""}
                        <span aria-hidden="true"> · </span>
                        <ListDate broadcast={broadcast} />
                      </span>
                    </p>
                    {reason && <StatusReason status={broadcast.status} reason={reason} className="mt-1.5" />}
                  </div>
                  <BroadcastSummary stats={broadcast.stats} />
                  <Chevron className="hidden @3xl/broadcast:block" />
                </div>
                {active && (
                  <div className="mt-3">
                    <BroadcastProgress broadcast={broadcast} />
                  </div>
                )}
                {canManage && active && (
                  <div className="relative z-10 mt-3 w-fit">
                    <BroadcastActions
                      projectId={projectId}
                      broadcastId={broadcast.id}
                      name={broadcast.name}
                      status={broadcast.status}
                      pending={broadcast.stats?.pending ?? 0}
                      onChanged={refresh}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty className="rounded-xl border border-dashed p-8">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Megaphone aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>Aucune diffusion pour l’instant</EmptyTitle>
            <EmptyDescription>
              Annoncez une promotion, un nouvel arrivage ou un changement d’horaires à vos clients
              WhatsApp, en un seul envoi. Seuls les contacts qui vous ont déjà écrit la recevront.
            </EmptyDescription>
          </EmptyHeader>
          {canCreate && (
            <EmptyContent>
              <Button asChild>
                <Link href={`${base}/new`}>
                  <Plus data-icon="inline-start" />
                  Créer une diffusion
                </Link>
              </Button>
            </EmptyContent>
          )}
        </Empty>
      )}
    </div>
  );
}
