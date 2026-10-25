import {
  Ban,
  CirclePause,
  CirclePlay,
  CircleCheckBig,
  Flag,
  PencilLine,
  Send,
} from "lucide-react";

import { BROADCAST_EVENT_LABEL, BROADCAST_REASON_LABEL } from "@/lib/broadcast-shared";
import type { BroadcastStats, TimelineEvent } from "@/lib/broadcasts";
import { cn } from "@/lib/utils";

const number = (value: number) => value.toLocaleString("fr-FR");
const percent = (value: number, base: number) => (base ? Math.round((value / base) * 100) : 0);

/**
 * Conversion funnel: each step is shown against the targeted contacts, with
 * the drop from the previous step, so the weak link is visible at a glance.
 */
export function BroadcastFunnel({ stats, targeted }: { stats: BroadcastStats | null; targeted: number }) {
  const steps = [
    { label: "Ciblés", value: targeted, hint: "Contacts retenus à la création." },
    { label: "Envoyés", value: stats?.sent ?? 0, hint: "Acceptés par WhatsApp." },
    { label: "Distribués", value: stats?.delivered ?? 0, hint: "Arrivés sur le téléphone du client." },
    { label: "Lus", value: stats?.read ?? 0, hint: "Selon les accusés de lecture du client." },
    { label: "Ont répondu", value: stats?.replied ?? 0, hint: "Dans les 7 jours suivant le message." },
  ];
  return (
    <section aria-labelledby="broadcast-funnel" className="rounded-2xl border bg-card p-4 sm:p-6">
      <h2 id="broadcast-funnel" className="font-heading text-lg font-semibold tracking-tight">
        Parcours des messages
      </h2>
      <ol className="mt-5 space-y-4">
        {steps.map((step, index) => {
          const share = percent(step.value, targeted);
          const previous = index ? steps[index - 1].value : null;
          return (
            <li key={step.label} className="grid gap-2 sm:grid-cols-[9rem_minmax(0,1fr)_6rem] sm:items-center">
              <div>
                <p className="text-sm font-medium">{step.label}</p>
                <p className="text-[11px] text-muted-foreground">{step.hint}</p>
              </div>
              <div aria-hidden="true" className="h-3 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full transition-[width]", index ? "bg-foreground/80" : "bg-foreground")}
                  style={{ width: `${share}%` }}
                />
              </div>
              <p className="flex items-baseline gap-2 sm:justify-end">
                <span className="font-heading text-xl font-semibold tabular-nums">{number(step.value)}</span>
                <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                  {index ? `${share} %` : "100 %"}
                </span>
                <span className="sr-only">
                  {previous !== null ? `, soit ${percent(step.value, previous)} % de l’étape précédente` : ""}
                </span>
              </p>
            </li>
          );
        })}
      </ol>
      {(stats?.failed || stats?.skipped) ? (
        <p className="mt-5 border-t pt-4 text-xs text-muted-foreground">
          {number(stats?.failed ?? 0)} échec{(stats?.failed ?? 0) > 1 ? "s" : ""} d’envoi ·{" "}
          {number(stats?.skipped ?? 0)} ignoré{(stats?.skipped ?? 0) > 1 ? "s" : ""} (désinscrits ou diffusion annulée)
        </p>
      ) : null}
    </section>
  );
}

const EVENT_ICON = {
  CREATED: PencilLine,
  STARTED: Send,
  PAUSED: CirclePause,
  RESUMED: CirclePlay,
  CANCELLED: Ban,
  COMPLETED: CircleCheckBig,
} as const;

const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });

/** Audit trail: who did what, and every automatic stop with its reason. */
export function BroadcastTimeline({ events }: { events: TimelineEvent[] }) {
  return (
    <section aria-labelledby="broadcast-timeline" className="rounded-2xl border bg-card p-4">
      <h2 id="broadcast-timeline" className="flex items-center gap-2 text-sm font-semibold">
        <Flag aria-hidden="true" className="size-4" />
        Journal
      </h2>
      {events.length ? (
        <ol className="relative mt-4 space-y-4 before:absolute before:top-1 before:bottom-1 before:left-3 before:w-px before:bg-border">
          {events.map((event) => {
            const Icon = EVENT_ICON[event.type];
            const who = event.actor ?? (event.type === "PAUSED" || event.type === "COMPLETED" || event.type === "STARTED" ? "Automatique" : "Membre retiré");
            const reason =
              event.type === "PAUSED" && event.detail && event.detail !== "MANUAL"
                ? BROADCAST_REASON_LABEL[event.detail]
                : event.detail === "TAKEN_OVER"
                  ? "Les messages partent désormais au nom de la personne qui l’a reprise."
                  : event.detail === "SCHEDULED"
                    ? "Envoi programmé."
                    : null;
            return (
              <li key={event.id} className="relative flex gap-3 pl-0">
                <span className="relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border bg-card">
                  <Icon aria-hidden="true" className="size-3.5" />
                </span>
                <div className="min-w-0 pt-0.5">
                  <p className="text-sm">
                    {BROADCAST_EVENT_LABEL[event.type]}
                    <span className="text-muted-foreground"> · {who}</span>
                  </p>
                  {reason && <p className="text-xs text-muted-foreground">{reason}</p>}
                  <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
                    <time dateTime={event.createdAt}>{dateTime.format(new Date(event.createdAt))}</time>
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">Aucun événement enregistré.</p>
      )}
    </section>
  );
}
