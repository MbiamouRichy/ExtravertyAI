import { Bot, UsersRound } from "lucide-react";

import { formatNumberFr, formatPctFr } from "@/lib/analytics";
import { AnalyticsCard } from "./analytics-card";
import { ChartEmptyState } from "./chart-empty-state";

export function RespondersCard({
  responders,
  rangeLabel,
}: {
  responders: { ai: number; team: number };
  rangeLabel: string;
}) {
  const total = responders.ai + responders.team;
  const rows = [
    { id: "ai", label: "Assistant IA", icon: Bot, count: responders.ai },
    { id: "team", label: "Équipe", icon: UsersRound, count: responders.team },
  ];

  return (
    <AnalyticsCard
      title="Qui répond ?"
      description={`Réponses envoyées · ${rangeLabel}`}
      aside={
        <span className="text-xs font-medium tabular-nums text-muted-foreground">
          {formatNumberFr(total)} réponses
        </span>
      }
    >
      {total === 0 ? (
        <ChartEmptyState
          icon={Bot}
          title="Aucune réponse envoyée"
          description="La répartition apparaîtra dès qu’un message sera envoyé par l’IA ou l’équipe."
        />
      ) : (
        <div className="space-y-4">
          <div aria-hidden="true" className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-muted">
            {rows.map((row, index) =>
              row.count > 0 ? (
                <div
                  key={row.id}
                  className={index === 0 ? "bg-foreground" : "bg-muted-foreground/40"}
                  style={{ width: `${(row.count / total) * 100}%` }}
                />
              ) : null,
            )}
          </div>
          <dl className="grid grid-cols-2 gap-3">
            {rows.map(({ id, label, icon: Icon, count }) => (
              <div key={id} className="rounded-xl border p-3">
                <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Icon aria-hidden="true" className="size-3.5" />
                  {label}
                </dt>
                <dd className="mt-1 font-heading text-2xl font-bold tabular-nums">
                  {formatPctFr((count / total) * 100, 0)}
                </dd>
                <dd className="text-xs tabular-nums text-muted-foreground">
                  {formatNumberFr(count)} message{count > 1 ? "s" : ""}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </AnalyticsCard>
  );
}
