import Link from "next/link";
import { ArrowRight, KanbanSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatDealValue } from "@/lib/pipeline-shared";
import { AnalyticsCard } from "./analytics-card";

/** Même emplacement que la carte réelle, pour les offres sans pipeline. */
export function PipelineValueLockedCard({
  planName,
  upgradeHref,
}: {
  planName: string;
  /** Null quand le membre ne peut pas ouvrir la facturation. */
  upgradeHref: string | null;
}) {
  return (
    <AnalyticsCard
      title="Valeur commerciale"
      description={`Disponible avec l’offre ${planName}`}
      footer="Les prospects repérés par Instinct IA sont conservés : ils sont déjà classés au passage à l’offre supérieure."
    >
      <div className="flex h-full flex-col items-start gap-3 rounded-xl border border-dashed p-4">
        <span className="flex size-9 items-center justify-center rounded-lg border bg-muted/50">
          <KanbanSquare aria-hidden="true" className="size-4" />
        </span>
        <p className="max-w-sm text-sm text-muted-foreground">
          Chiffre gagné, panier moyen et affaires en cours, calculés depuis le pipeline de
          ventes.
        </p>
        {upgradeHref ? (
          <Button asChild variant="outline" size="sm">
            <Link href={upgradeHref}>
              Passer à {planName}
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">
            Le propriétaire du projet peut changer d’offre depuis la facturation.
          </p>
        )}
      </div>
    </AnalyticsCard>
  );
}

export function PipelineValueCard({
  currency,
  won,
  open,
  rangeLabel,
  pipelineHref,
}: {
  currency: string;
  won: { total: number; deals: number };
  open: { total: number; count: number };
  rangeLabel: string;
  pipelineHref: string;
}) {
  const average = won.deals ? Math.round(won.total / won.deals) : null;

  return (
    <AnalyticsCard
      title="Valeur commerciale"
      description={`Affaires gagnées sur la période · ${rangeLabel}`}
      aside={
        <Button asChild variant="outline" size="sm">
          <Link href={pipelineHref}>
            Ouvrir le pipeline
            <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
      }
      footer="Les montants sont saisis par votre équipe sur chaque prospect, dans la devise du projet."
    >
      <dl className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-3">
        {[
          { label: "Gagné", value: formatDealValue(won.total, currency), hint: `${won.deals} affaire${won.deals > 1 ? "s" : ""}` },
          { label: "Panier moyen", value: average === null ? "—" : formatDealValue(average, currency), hint: "Par affaire gagnée" },
          { label: "En cours", value: formatDealValue(open.total, currency), hint: `${open.count} affaire${open.count > 1 ? "s" : ""} chiffrée${open.count > 1 ? "s" : ""}` },
        ].map((stat) => (
          <div key={stat.label} className="flex flex-col-reverse gap-1 bg-card p-4">
            <dt className="text-xs text-muted-foreground">
              {stat.label}
              <span className="block text-[11px]">{stat.hint}</span>
            </dt>
            <dd className="truncate font-heading text-2xl font-bold tracking-tight tabular-nums">
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>
    </AnalyticsCard>
  );
}
