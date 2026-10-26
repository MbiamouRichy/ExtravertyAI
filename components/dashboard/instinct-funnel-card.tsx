import Link from "next/link";
import { Sparkles } from "lucide-react";

import { formatNumberFr, formatPctFr } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { AnalyticsCard } from "./analytics-card";
import { ChartEmptyState } from "./chart-empty-state";

export function InstinctFunnelCard({
  instinct,
  rangeLabel,
  settingsHref,
}: {
  instinct: { active: number; followUp: number; interesting: number } | null;
  rangeLabel: string;
  settingsHref: string;
}) {
  if (!instinct) {
    return (
      <AnalyticsCard title="Instinct IA" description="Du contact actif au prospect intéressant">
        <ChartEmptyState
          icon={Sparkles}
          title="Qualification désactivée"
          description="Activez la qualification des prospects dans les réglages de l’agent pour suivre vos prospects."
        />
        <div className="mt-2 flex justify-center">
          <Button asChild variant="outline" size="sm">
            <Link href={settingsHref}>Ouvrir les réglages</Link>
          </Button>
        </div>
      </AnalyticsCard>
    );
  }

  const steps = [
    { id: "active", label: "Contacts actifs", value: instinct.active },
    { id: "follow", label: "À suivre", value: instinct.followUp },
    { id: "interesting", label: "Prospects intéressants", value: instinct.interesting },
  ];
  const max = Math.max(instinct.active, 1);

  return (
    <AnalyticsCard
      title="Instinct IA"
      description={`Du contact actif au prospect intéressant · ${rangeLabel}`}
      footer={
        instinct.active > 0 ? (
          <span className="flex items-center gap-1.5">
            <Sparkles aria-hidden="true" className="size-3.5 shrink-0" />
            {formatPctFr((instinct.interesting / instinct.active) * 100)} des contacts
            actifs sont des prospects intéressants, selon la dernière analyse.
          </span>
        ) : undefined
      }
    >
      {instinct.active === 0 ? (
        <ChartEmptyState
          icon={Sparkles}
          title="Aucun contact actif"
          description="Instinct IA classe vos contacts après chaque nouveau message."
        />
      ) : (
        <ol className="space-y-4">
          {steps.map((step) => (
            <li key={step.id}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                <span>{step.label}</span>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {formatNumberFr(step.value)}
                </span>
              </div>
              <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-foreground/80"
                  style={{ width: `${Math.max(step.value > 0 ? 2 : 0, (step.value / max) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </AnalyticsCard>
  );
}
