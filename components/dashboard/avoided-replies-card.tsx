import Link from "next/link";

import type { AvoidedReplies } from "@/lib/ai-quiet";
import { AnalyticsCard } from "./analytics-card";

const ROWS = [
  { key: "quiet", label: "Fin de conversation", hint: "« merci », « d’accord » après la conclusion" },
  { key: "merged", label: "Messages regroupés", hint: "plusieurs messages d’affilée, une seule réponse" },
  { key: "repeated", label: "Répétitions évitées", hint: "réponse identique à un message déjà envoyé" },
] as const;

/** Client messages the assistant deliberately left unanswered: each one is a message saved on the quota. */
export function AvoidedRepliesCard({
  stats,
  enabled,
  rangeLabel,
  settingsHref,
}: {
  stats: AvoidedReplies;
  enabled: boolean;
  rangeLabel: string;
  settingsHref: string;
}) {
  return (
    <AnalyticsCard
      title="Réponses évitées"
      description={`Messages inutiles que l’IA n’a pas envoyés · ${rangeLabel}`}
      footer={
        enabled ? (
          "Autant de messages économisés sur votre quota, sans relance inutile de vos clients."
        ) : (
          <>
            La mise en veille de fin de conversation est désactivée.{" "}
            <Link href={settingsHref} className="text-foreground underline-offset-4 hover:underline">
              L’activer dans les paramètres
            </Link>
          </>
        )
      }
    >
      <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
        <p className="flex flex-col">
          <span className="font-heading text-5xl font-bold tracking-tight tabular-nums">
            {stats.total.toLocaleString("fr-FR")}
          </span>
          <span className="text-sm text-muted-foreground">
            message{stats.total > 1 ? "s" : ""} non envoyé{stats.total > 1 ? "s" : ""}
          </span>
        </p>
        <dl className="divide-y text-sm">
          {ROWS.map((row) => (
            <div key={row.key} className="flex items-baseline justify-between gap-4 py-2 first:pt-0 last:pb-0">
              <dt className="min-w-0">
                <span className="block">{row.label}</span>
                <span className="block text-xs text-muted-foreground">{row.hint}</span>
              </dt>
              <dd className="font-mono tabular-nums">{stats[row.key].toLocaleString("fr-FR")}</dd>
            </div>
          ))}
        </dl>
      </div>
    </AnalyticsCard>
  );
}
