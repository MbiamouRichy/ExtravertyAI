"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDownToLine, Loader2, Lock } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { PLAN_FEATURES } from "@/lib/plan-features";
import { PRICING_PLANS, type PlanId } from "@/lib/pricing";
import {
  ANALYTICS_PERIOD_OPTIONS,
  PERIOD_DAYS,
  analyticsPeriodAllowed,
  isAnalyticsPeriod,
  type AnalyticsPeriod,
  type DiscussionPoint,
  type VolumePoint,
} from "@/lib/analytics";

/** Sur très petit écran, seul le nombre tient : « jours » reste dans l’aria-label. */
function PeriodLabel({ shortLabel }: { shortLabel: string }) {
  const [days, unit] = shortLabel.split(" ");
  return (
    <span>
      {days}
      <span className="@max-[21rem]:hidden"> {unit}</span>
    </span>
  );
}

/** Nom de la première offre qui débloque la période, ou null si elle est incluse. */
function planUnlocking(
  period: AnalyticsPeriod,
  analyticsDays: number,
): string | null {
  if (analyticsPeriodAllowed(period, analyticsDays)) return null;
  const plan = PRICING_PLANS.find(
    (item) => PLAN_FEATURES[item.id].analyticsDays >= PERIOD_DAYS[period],
  );
  return plan?.name ?? "Business";
}

interface AnalyticsHeaderProps {
  projectName: string;
  period: AnalyticsPeriod;
  plan: PlanId;
  analyticsDays: number;
  billingHref: string;
  rangeLabel: string;
  timeZone: string;
  volumeSeries: VolumePoint[];
  discussionsSeries: DiscussionPoint[];
}

function csvCell(value: string | number): string {
  let text = String(value);

  // Défense en profondeur contre les formules de tableur.
  // L'export actuel ne contient ni noms ni téléphones.
  if (
    typeof value === "string" &&
    (/^[\s\u0000-\u001f]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text))
  ) {
    text = `'${text}`;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

export function AnalyticsHeader({
  projectName,
  period,
  plan,
  analyticsDays,
  billingHref,
  rangeLabel,
  timeZone,
  volumeSeries,
  discussionsSeries,
}: AnalyticsHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isPending, startTransition] = useTransition();
  const [exportMessage, setExportMessage] = useState("");

  function changePeriod(value: string) {
    if (
      !isAnalyticsPeriod(value) ||
      value === period ||
      isPending ||
      !analyticsPeriodAllowed(value, analyticsDays)
    ) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set("period", value);
    setExportMessage("");

    startTransition(() => {
      // push permet de revenir à la période précédente via le navigateur.
      router.push(`${pathname}?${params.toString()}`, {
        scroll: false,
      });
    });
  }

  function exportCsv() {
    if (isPending || volumeSeries.length === 0) return;

    let url: string | undefined;
    let link: HTMLAnchorElement | undefined;

    try {
      const discussionsByDate = new Map(
        discussionsSeries.map((point) => [point.date, point.count]),
      );

      const rows: (string | number)[][] = [
        [
          `Début du regroupement (${timeZone})`,
          "Messages reçus",
          "Messages envoyés",
          "Nouveaux contacts",
        ],
        ...volumeSeries.map((point) => [
          point.date,
          point.received,
          point.sent,
          discussionsByDate.get(point.date) ?? 0,
        ]),
      ];

      const csv = rows.map((row) => row.map(csvCell).join(";")).join("\r\n");

      const blob = new Blob([`\uFEFF${csv}`], {
        type: "text/csv;charset=utf-8;",
      });

      url = URL.createObjectURL(blob);
      link = document.createElement("a");
      link.href = url;
      link.download = `extravertyai-analytics-${period}-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;

      document.body.appendChild(link);
      link.click();

      setExportMessage("Export CSV préparé, sans données de contact.");
    } catch {
      toast.error("L’export n’a pas pu être préparé. Réessayez.");
    } finally {
      link?.remove();

      if (url) {
        const objectUrl = url;

        window.setTimeout(() => {
          URL.revokeObjectURL(objectUrl);
        }, 1000);
      }
    }
  }

  return (
    <header className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="truncate text-sm text-muted-foreground">{projectName}</p>
        </div>

        <Button
          type="button"
          variant="outline"
          className="shrink-0 gap-2"
          aria-label="Exporter CSV"
          onClick={exportCsv}
          disabled={isPending || volumeSeries.length === 0}
        >
          <ArrowDownToLine aria-hidden="true" className="size-4" />
          <span className="sm:hidden">CSV</span>
          <span className="max-sm:hidden">Exporter CSV</span>
        </Button>
      </div>

      <div className="flex flex-col gap-2 @3xl:flex-row @3xl:items-center @3xl:justify-between">
        <fieldset disabled={isPending} className="min-w-0">
          <legend className="sr-only">Période d’analyse</legend>

          <div className="grid auto-cols-fr grid-flow-col gap-0.5 rounded-lg bg-muted p-0.5 @3xl:w-fit">
            {ANALYTICS_PERIOD_OPTIONS.map((option) => {
              const unlockPlan = planUnlocking(option.value, analyticsDays);

              if (unlockPlan) {
                // Visible mais verrouillée : l'offre requise est annoncée.
                return (
                  <Tooltip key={option.value}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        type="button"
                        aria-disabled="true"
                        aria-label={`${option.label} : disponible avec l’offre ${unlockPlan}`}
                        onClick={(event) => event.preventDefault()}
                        className="h-9 min-w-0 cursor-not-allowed gap-0.5 rounded-md px-0 text-xs text-muted-foreground/60 hover:bg-transparent hover:text-muted-foreground/60 sm:gap-1 sm:px-3 sm:text-sm"
                      >
                        <Lock aria-hidden="true" className="size-2.5 @max-[21rem]:hidden sm:size-3" />
                        <PeriodLabel shortLabel={option.shortLabel} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Disponible avec l’offre {unlockPlan}
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return (
                <Button
                  variant="ghost"
                  key={option.value}
                  type="button"
                  aria-pressed={period === option.value}
                  aria-label={option.label}
                  onClick={() => changePeriod(option.value)}
                  className={cn(
                    "h-9 min-w-0 rounded-md px-0 text-xs sm:px-3 sm:text-sm",
                    "transition-colors motion-reduce:transition-none",
                    "disabled:cursor-wait disabled:opacity-60",
                    period === option.value
                      ? "bg-background text-foreground shadow-sm hover:bg-background"
                      : "text-muted-foreground hover:bg-transparent hover:text-foreground",
                  )}
                >
                  <PeriodLabel shortLabel={option.shortLabel} />
                </Button>
              );
            })}
          </div>
        </fieldset>

        <p className="text-xs text-muted-foreground">
          {rangeLabel} · {timeZone}
        </p>
      </div>

      {plan !== "business" && (
        <p className="text-xs text-muted-foreground">
          Historique limité à {analyticsDays} jours avec votre offre.{" "}
          <Link
            href={billingHref}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Voir les offres
          </Link>
        </p>
      )}

      {/* Seule l’actualisation s’affiche ; la fin d’export reste annoncée aux lecteurs d’écran. */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={cn(
          "items-center gap-2 text-xs text-muted-foreground",
          isPending ? "flex" : "sr-only",
        )}
      >
        {isPending ? (
          <>
            <Loader2
              aria-hidden="true"
              className="size-3.5 animate-spin motion-reduce:animate-none"
            />
            Actualisation des indicateurs…
          </>
        ) : (
          exportMessage
        )}
      </div>
    </header>
  );
}
