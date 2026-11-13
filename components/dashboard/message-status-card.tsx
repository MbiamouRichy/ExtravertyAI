import { CheckCheck, CircleAlert } from "lucide-react";

import { AnalyticsCard } from "./analytics-card";
import { ChartEmptyState } from "./chart-empty-state";
import { cn } from "@/lib/utils";
import {
  MESSAGE_STATUS_META,
  formatNumberFr,
  formatPctFr,
  type MessageStatusKey,
  type StatusDatum,
} from "@/lib/analytics";

interface MessageStatusCardProps {
  statuses: StatusDatum[];
  total: number;
  rangeLabel: string;
}

type StatusRow = {
  key: MessageStatusKey;
  label: string;
  hint: string;
  count: number;
};

/**
 * Chaque message ne garde que son dernier statut : un message lu a aussi été
 * envoyé et distribué. On présente donc un entonnoir cumulatif (envoyés ⊇
 * distribués ⊇ lus) au lieu de statuts exclusifs, qui affichaient
 * « Distribués : 0 » pour des messages pourtant lus.
 */
function deliveryRows(statuses: StatusDatum[]): StatusRow[] {
  const count = (status: MessageStatusKey) =>
    statuses.find((item) => item.status === status)?.count ?? 0;
  const read = count("READ");
  const delivered = count("DELIVERED") + read;
  return [
    { key: "SENT", label: "Envoyés", hint: "Acceptés par WhatsApp", count: count("SENT") + delivered },
    { key: "DELIVERED", label: "Distribués", hint: "Arrivés sur le téléphone", count: delivered },
    { key: "READ", label: "Lus", hint: "Ouverts par le contact", count: read },
    { key: "PENDING", label: "En attente", hint: "Pas encore transmis", count: count("PENDING") },
    { key: "FAILED", label: "Échecs", hint: "Non envoyés", count: count("FAILED") },
  ];
}

export function MessageStatusCard({
  statuses,
  total,
  rangeLabel,
}: MessageStatusCardProps) {
  const failedCount =
    statuses.find((item) => item.status === "FAILED")?.count ?? 0;
  const rows = deliveryRows(statuses);

  return (
    <AnalyticsCard
      title="Livraison des messages"
      description={`Statuts des messages sortants · ${rangeLabel}`}
      aside={
        <span className="text-xs font-medium tabular-nums text-muted-foreground">
          {formatNumberFr(total)} sortants
        </span>
      }
    >
      {total === 0 ? (
        <ChartEmptyState
          icon={CheckCheck}
          title="Aucun message sortant"
          description="Les statuts apparaîtront dès qu’un message sera envoyé par l’IA ou un agent."
        />
      ) : (
        <div className="@container space-y-4">
          <ul className="divide-y divide-border/60 @2xl:grid @2xl:auto-cols-fr @2xl:grid-flow-col @2xl:gap-4 @2xl:divide-y-0">
            {rows.map(({ key, label, hint, count }) => {
              const share = (count / total) * 100;

              return (
                <li
                  key={key}
                  className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 @2xl:py-0"
                >
                  <div className="flex items-start justify-between gap-3 @2xl:flex-col @2xl:gap-1">
                    <span className="flex min-w-0 flex-col">
                      <span className="flex items-center gap-2.5 text-sm">
                        <span
                          aria-hidden="true"
                          className={cn("size-2 shrink-0 rounded-full", MESSAGE_STATUS_META[key].bar)}
                        />
                        {label}
                      </span>
                      <span className="pl-4.5 text-xs text-muted-foreground">
                        {hint}
                      </span>
                    </span>

                    <div className="shrink-0 text-right @2xl:flex @2xl:items-baseline @2xl:gap-2 @2xl:text-left">
                      <p className="text-sm font-medium tabular-nums @2xl:text-xl @2xl:font-semibold @2xl:tracking-tight">
                        {count.toLocaleString("fr-FR")}
                      </p>

                      <p className="mt-0.5 text-xs tabular-nums text-muted-foreground @2xl:mt-0">
                        {formatPctFr(share)}
                      </p>
                    </div>
                  </div>

                  <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full", MESSAGE_STATUS_META[key].bar)}
                      style={{ width: `${share}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>

          <p className="text-xs leading-relaxed text-muted-foreground">
            Pourcentages calculés sur les {formatNumberFr(total)} messages sortants.
            Un contact qui a désactivé les confirmations de lecture n’envoie
            jamais d’accusé : ses messages restent « distribués ».
          </p>

          {failedCount > 0 && (
            <div className="flex gap-2.5 rounded-xl border border-border/30 bg-primary/10 p-3">
              <CircleAlert
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-foreground dark:text-foreground"
              />

              <p className="text-xs leading-relaxed text-foreground dark:text-foreground">
                {formatNumberFr(failedCount)} message
                {failedCount > 1 ? "s" : ""} en échec. Consultez les
                conversations concernées pour identifier la cause.
              </p>
            </div>
          )}
        </div>
      )}
    </AnalyticsCard>
  );
}
