"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDownToLine, CalendarDays, Loader2, Lock } from "lucide-react";
import Link from "next/link";

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
      setExportMessage("L’export n’a pas pu être préparé. Réessayez.");
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
    <header className="space-y-5 border-b border-border/70 pb-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-muted-foreground">
            {projectName}
          </p>

          <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
            Analytics
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Une vue claire de vos échanges WhatsApp et de l’activité de votre
            IA.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-10 gap-2 rounded-xl bg-background"
            onClick={exportCsv}
            disabled={isPending || volumeSeries.length === 0}
          >
            <ArrowDownToLine aria-hidden="true" className="size-4" />
            Exporter CSV
          </Button>
        </div>
      </div>

      <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-center">
        <fieldset disabled={isPending} className="min-w-0">
          <legend className="sr-only">Période d’analyse</legend>

          <div className="flex w-fit max-w-full flex-wrap gap-1 rounded-xl border bg-background p-1 shadow-sm">
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
                        className="min-h-10 min-w-11 cursor-not-allowed gap-1 rounded-lg px-3 text-sm font-medium text-muted-foreground/60 hover:bg-transparent hover:text-muted-foreground/60"
                      >
                        <Lock aria-hidden="true" className="size-3" />
                        {option.shortLabel}
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
                    "min-h-10 min-w-11 rounded-lg px-3 text-sm font-medium",
                    "transition-colors motion-reduce:transition-none",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    "disabled:cursor-wait disabled:opacity-60",
                    period === option.value
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {option.shortLabel}
                </Button>
              );
            })}
          </div>
          {plan !== "business" && (
            <p className="mt-2 text-xs text-muted-foreground">
              Historique limité à {analyticsDays} jours avec votre offre.{" "}
              <Link
                href={billingHref}
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                Voir les offres
              </Link>
            </p>
          )}
        </fieldset>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CalendarDays aria-hidden="true" className="size-4 shrink-0" />
          <span>
            {rangeLabel} · {timeZone}
          </span>
        </div>
      </div>

      {/* Announce only active navigation or export feedback. */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={cn(
          "items-center gap-2 text-xs text-muted-foreground",
          isPending || exportMessage ? "flex" : "sr-only",
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
