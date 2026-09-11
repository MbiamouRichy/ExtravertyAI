"use client";

import { useState, useTransition } from "react";
import {
    usePathname,
    useRouter,
    useSearchParams,
} from "next/navigation";
import {
    ArrowDownToLine,
    CalendarDays,
    Loader2,
    RefreshCw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
    ANALYTICS_PERIOD_OPTIONS,
    isAnalyticsPeriod,
    type AnalyticsPeriod,
    type DiscussionPoint,
    type VolumePoint,
} from "@/lib/analytics";

interface AnalyticsHeaderProps {
    projectName: string;
    period: AnalyticsPeriod;
    rangeLabel: string;
    volumeSeries: VolumePoint[];
    discussionsSeries: DiscussionPoint[];
}

function csvCell(value: string | number): string {
    let text = String(value);

    // Défense en profondeur contre les formules de tableur.
    // L'export actuel ne contient ni noms ni téléphones.
    if (
        typeof value === "string" &&
        (/^[\s\u0000-\u001f]*[=+\-@]/.test(text) ||
            /^[\t\r\n]/.test(text))
    ) {
        text = `'${text}`;
    }

    return `"${text.replace(/"/g, '""')}"`;
}

export function AnalyticsHeader({
    projectName,
    period,
    rangeLabel,
    volumeSeries,
    discussionsSeries,
}: AnalyticsHeaderProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [isPending, startTransition] = useTransition();
    const [exportMessage, setExportMessage] = useState("");

    function changePeriod(value: string) {
        if (!isAnalyticsPeriod(value) || value === period || isPending) {
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

    function refresh() {
        setExportMessage("");

        startTransition(() => {
            router.refresh();
        });
    }

    function exportCsv() {
        if (isPending || volumeSeries.length === 0) return;

        let url: string | undefined;
        let link: HTMLAnchorElement | undefined;

        try {
            const discussionsByDate = new Map(
                discussionsSeries.map((point) => [
                    point.date,
                    point.count,
                ]),
            );

            const rows: (string | number)[][] = [
                [
                    "Début du regroupement (UTC)",
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

            const csv = rows
                .map((row) => row.map(csvCell).join(";"))
                .join("\r\n");

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
            setExportMessage(
                "L’export n’a pas pu être préparé. Réessayez.",
            );
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
                        Une vue claire de vos échanges WhatsApp et de
                        l’activité de votre IA.
                    </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-10 rounded-xl bg-background"
                        onClick={refresh}
                        disabled={isPending}
                        aria-label="Actualiser les statistiques"
                    >
                        <RefreshCw
                            aria-hidden="true"
                            className={cn(
                                "size-4",
                                isPending &&
                                "animate-spin motion-reduce:animate-none",
                            )}
                        />
                    </Button>

                    <Button
                        type="button"
                        variant="outline"
                        className="h-10 gap-2 rounded-xl bg-background"
                        onClick={exportCsv}
                        disabled={isPending || volumeSeries.length === 0}
                    >
                        <ArrowDownToLine
                            aria-hidden="true"
                            className="size-4"
                        />
                        Exporter CSV
                    </Button>
                </div>
            </div>

            <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-center">
                <fieldset disabled={isPending} className="min-w-0">
                    <legend className="sr-only">
                        Période d’analyse
                    </legend>

                    <div className="flex w-fit max-w-full flex-wrap gap-1 rounded-xl border bg-background p-1 shadow-sm">
                        {ANALYTICS_PERIOD_OPTIONS.map((option) => (
                            <button
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
                            </button>
                        ))}
                    </div>
                </fieldset>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CalendarDays
                        aria-hidden="true"
                        className="size-4 shrink-0"
                    />
                    <span>{rangeLabel} · UTC</span>
                </div>
            </div>

            {/* Espace réservé : pas de saut de mise en page pendant la navigation. */}
            <div
                role="status"
                aria-live="polite"
                aria-atomic="true"
                className="flex min-h-5 items-center gap-2 text-xs text-muted-foreground"
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
                    exportMessage || `Statistiques affichées ${rangeLabel}.`
                )}
            </div>
        </header>
    );
}