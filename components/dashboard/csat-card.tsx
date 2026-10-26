import Link from "next/link";
import { Star } from "lucide-react";

import { AnalyticsCard } from "./analytics-card";

export function CsatCard({
  stats,
  rangeLabel,
  enabled,
  settingsHref,
}: {
  stats: { sent: number; responses: number; average: number | null; distribution: number[] };
  rangeLabel: string;
  enabled: boolean;
  settingsHref: string;
}) {
  const max = Math.max(1, ...stats.distribution);
  const rate = stats.sent ? Math.round((stats.responses / stats.sent) * 100) : null;
  const average = stats.average === null ? null : stats.average.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

  return (
    <AnalyticsCard
      title="Satisfaction client"
      description={`Notes de 1 à 5 après résolution · ${rangeLabel}`}
      footer={
        enabled ? (
          `${stats.sent.toLocaleString("fr-FR")} questionnaire(s) envoyé(s)${rate === null ? "" : `, ${rate} % de réponses`}.`
        ) : (
          <>
            Le questionnaire est désactivé.{" "}
            <Link href={settingsHref} className="text-foreground underline-offset-4 hover:underline">
              L’activer dans les paramètres
            </Link>
          </>
        )
      }
    >
      <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
        <p className="flex items-baseline gap-1.5">
          <span className="font-heading text-5xl font-bold tracking-tight tabular-nums">{average ?? "—"}</span>
          <span className="text-sm text-muted-foreground">/ 5</span>
          <span className="sr-only">
            {average === null ? "Aucune note sur la période" : `Note moyenne ${average} sur 5, ${stats.responses} réponses`}
          </span>
        </p>
        <ol aria-label="Répartition des notes" className="space-y-1.5">
          {[5, 4, 3, 2, 1].map((score) => {
            const count = stats.distribution[score - 1] ?? 0;
            return (
              <li key={score} className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center gap-2 text-xs">
                <span className="flex items-center gap-1 tabular-nums text-muted-foreground">
                  {score}
                  <Star aria-hidden="true" className="size-3" />
                </span>
                <span aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-foreground"
                    style={{ width: `${(count / max) * 100}%` }}
                  />
                </span>
                <span className="text-right tabular-nums">
                  {count}
                  <span className="sr-only"> réponse(s) à {score} étoile(s)</span>
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </AnalyticsCard>
  );
}
