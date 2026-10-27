"use client";

import { LocalDate } from "@/components/local-date";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";
import { ArrowRight, CircleAlert, Clock3, ImageIcon, Megaphone, Plus, WifiOff } from "lucide-react";

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
import { ACTIVE_STATUSES, type BroadcastUsageView, type BroadcastView } from "./types";

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

export function StatusLine({ broadcast }: { broadcast: Pick<BroadcastView, "status" | "pauseReason" | "nextSendAt" | "scheduledAt"> }) {
  const reason = broadcast.pauseReason ? BROADCAST_REASON_LABEL[broadcast.pauseReason] : null;
  const tone =
    broadcast.status === "PAUSED"
      ? "border-destructive/40 text-destructive"
      : broadcast.status === "SENDING"
        ? "bg-primary text-primary-foreground border-transparent"
        : "text-muted-foreground";
  return (
    <div className="flex flex-col gap-1">
      <span
        className={cn(
          "inline-flex w-fit items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider",
          tone,
        )}
      >
        {broadcast.status === "SENDING" && (
          <span aria-hidden="true" className="size-1.5 animate-pulse rounded-full bg-current motion-reduce:animate-none" />
        )}
        {BROADCAST_STATUS_LABEL[broadcast.status]}
      </span>
      {broadcast.status === "SCHEDULED" && !reason && (
        <span className="text-xs text-muted-foreground">Départ prévu le <LocalDate value={broadcast.scheduledAt} options={dateTime} /></span>
      )}
      {reason && (
        <span className={cn("flex items-start gap-1 text-xs", broadcast.status === "PAUSED" ? "text-destructive" : "text-muted-foreground")}>
          {broadcast.status === "PAUSED" ? (
            <CircleAlert aria-hidden="true" className="mt-0.5 size-3 shrink-0" />
          ) : (
            <Clock3 aria-hidden="true" className="mt-0.5 size-3 shrink-0" />
          )}
          {reason}
        </span>
      )}
    </div>
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
      <p className="mt-1.5 font-mono text-[11px] tabular-nums text-muted-foreground">
        {number(done)} / {number(broadcast.recipientCount)} traités
      </p>
    </div>
  );
}

export function BroadcastKpis({ broadcast, size = "sm" }: { broadcast: BroadcastView; size?: "sm" | "lg" }) {
  const stats = broadcast.stats;
  const base = stats?.queued || 0;
  const rate = (value: number) => (base ? ` · ${Math.round((value / base) * 100)} %` : "");
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
        "grid gap-px overflow-hidden rounded-xl border bg-border",
        size === "lg" ? "grid-cols-2 sm:grid-cols-5" : "grid-cols-3 sm:grid-cols-5",
      )}
    >
      {items.map((item) => (
        <div key={item.label} className={cn("flex flex-col-reverse gap-0.5 bg-card", size === "lg" ? "p-4" : "p-2.5")}>
          <dt className="text-[11px] text-muted-foreground">
            {item.label}
            {item.extra}
          </dt>
          <dd className={cn("font-heading font-semibold tabular-nums", size === "lg" ? "text-2xl" : "text-base")}>
            {number(item.value)}
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
  const active = broadcasts.find((broadcast) => ACTIVE_STATUSES.includes(broadcast.status));
  const base = `/projects/${projectId}/broadcasts`;

  return (
    <div className="space-y-6">
      <section aria-label="Utilisation" className="flex flex-col gap-5 rounded-2xl border bg-card p-4 sm:flex-row sm:p-5">
        <Meter
          label="Messages de diffusion ce mois-ci"
          used={usage.monthly.used}
          limit={usage.monthly.limit}
          hint={usage.monthly.reserved ? `${number(usage.monthly.reserved)} encore prévus dans la diffusion en cours.` : undefined}
        />
        <Meter label="Aujourd’hui" used={usage.daily.used} limit={usage.daily.limit} />
        <div className="min-w-0 flex-1 text-xs text-muted-foreground sm:max-w-64">
          <p>
            Jusqu’à <span className="text-foreground">{number(usage.recipientsLimit)} contacts</span> par diffusion,
            envoyés entre {BROADCAST_WINDOW.startHour} h et {BROADCAST_WINDOW.endHour} h (heure de Libreville), au
            rythme d’un message toutes les 8 à 15 secondes pour protéger votre numéro.
          </p>
        </div>
      </section>

      {!connected && (
        <p role="status" className="flex items-start gap-2 rounded-xl border border-destructive/40 p-3 text-sm text-destructive">
          <WifiOff aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          WhatsApp n’est pas connecté : les diffusions attendent sa reconnexion pour partir.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-lg font-semibold tracking-tight">Vos diffusions</h2>
        {canCreate &&
          (active ? (
            <p className="text-xs text-muted-foreground">Une seule diffusion à la fois : « {active.name} » est en cours.</p>
          ) : (
            <Button asChild>
              <Link href={`${base}/new`}>
                <Plus data-icon="inline-start" />
                Nouvelle diffusion
              </Link>
            </Button>
          ))}
      </div>

      {broadcasts.length ? (
        <ul className="space-y-3">
          {broadcasts.map((broadcast) => (
            <li key={broadcast.id} className="rounded-2xl border bg-card p-4 sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="flex items-center gap-2 truncate text-base font-semibold">
                        <Link
                          href={`${base}/${broadcast.id}`}
                          className="truncate underline-offset-4 outline-none hover:underline focus-visible:underline"
                        >
                          {broadcast.name}
                        </Link>
                        {broadcast.hasImage && (
                          <ImageIcon aria-label="Avec image" className="size-3.5 shrink-0 text-muted-foreground" />
                        )}
                      </h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {number(broadcast.recipientCount)} contact{broadcast.recipientCount > 1 ? "s" : ""} ·{" "}
                        {broadcast.finishedAt ? "terminée le " : "créée le "}
                        <LocalDate value={broadcast.finishedAt ?? broadcast.createdAt} options={dateTime} />
                        {broadcast.author ? ` par ${broadcast.author}` : ""}
                      </p>
                    </div>
                    <StatusLine broadcast={broadcast} />
                  </div>
                  <BroadcastProgress broadcast={broadcast} />
                  <BroadcastKpis broadcast={broadcast} />
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2 lg:flex-col lg:items-end">
                  {canManage && (
                    <BroadcastActions
                      projectId={projectId}
                      broadcastId={broadcast.id}
                      name={broadcast.name}
                      status={broadcast.status}
                      pending={broadcast.stats?.pending ?? 0}
                      onChanged={refresh}
                    />
                  )}
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`${base}/${broadcast.id}`}>
                      Détail
                      <ArrowRight data-icon="inline-end" />
                    </Link>
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <Empty className="rounded-2xl border border-dashed p-10">
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
