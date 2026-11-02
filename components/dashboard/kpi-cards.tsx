import { ArrowDownRight, ArrowUpRight, Info, Minus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
    formatNumberFr,
    formatPctFr,
    type AnalyticsKpis,
} from "@/lib/analytics";

interface AnalyticsKpiGridProps {
    kpis: AnalyticsKpis;
}

interface KpiItem {
    label: string;
    value: string;
    current: number | null;
    previousValue: number | null;
    delta: number | null;
    unit: "%" | "pt";
    previous: string;
    definition: string;
}

function Delta({
    value,
    unit,
    current,
    previous,
}: {
    value: number | null;
    unit: "%" | "pt";
    current: number | null;
    previous: number | null;
}) {
    if (value === null || !Number.isFinite(value)) {
        // Aucune base de comparaison : on le dit simplement, sans faux pourcentage.
        const isNew = previous === 0 && !!current;
        return (
            <span
                className="font-medium"
                title={
                    isNew
                        ? "Aucune activité sur la période précédente"
                        : "Pas de données sur la période précédente"
                }
            >
                {isNew ? "Nouveau" : "—"}
            </span>
        );
    }

    const rounded = Math.round(value * 10) / 10;
    const Icon =
        rounded > 0 ? ArrowUpRight : rounded < 0 ? ArrowDownRight : Minus;

    const label = new Intl.NumberFormat("fr-FR", {
        maximumFractionDigits: 1,
        signDisplay: "exceptZero",
    }).format(rounded);

    return (
        <span
            className={cn(
                "inline-flex items-center gap-0.5 font-medium tabular-nums",
                rounded !== 0 && "text-foreground",
            )}
        >
            <Icon aria-hidden="true" className="size-3" strokeWidth={2.4} />
            {label} {unit === "%" ? "%" : "pts"}
            <span className="sr-only">par rapport à la période précédente</span>
        </span>
    );
}

export function AnalyticsKpiGrid({ kpis }: AnalyticsKpiGridProps) {
    const items: KpiItem[] = [
        {
            label: "Messages reçus",
            value: formatNumberFr(kpis.received.current),
            current: kpis.received.current,
            previousValue: kpis.received.previous,
            delta: kpis.received.deltaPct,
            unit: "%",
            previous: formatNumberFr(kpis.received.previous),
            definition:
                "Messages envoyés par les clients pendant la période sélectionnée.",
        },
        {
            label: "Messages envoyés",
            value: formatNumberFr(kpis.sent.current),
            current: kpis.sent.current,
            previousValue: kpis.sent.previous,
            delta: kpis.sent.deltaPct,
            unit: "%",
            previous: formatNumberFr(kpis.sent.previous),
            definition:
                "Messages sortants du bot et des agents, quel que soit leur statut de livraison.",
        },
        {
            label: "Nouveaux contacts",
            value: formatNumberFr(kpis.discussions.current),
            current: kpis.discussions.current,
            previousValue: kpis.discussions.previous,
            delta: kpis.discussions.deltaPct,
            unit: "%",
            previous: formatNumberFr(kpis.discussions.previous),
            definition:
                "Contacts créés pendant la période. Cet indicateur ne compte pas les sessions de discussion.",
        },
        {
            label: "Contacts actifs",
            value: formatNumberFr(kpis.activeContacts.current),
            current: kpis.activeContacts.current,
            previousValue: kpis.activeContacts.previous,
            delta: kpis.activeContacts.deltaPct,
            unit: "%",
            previous: formatNumberFr(kpis.activeContacts.previous),
            definition:
                "Contacts associés à au moins un message pendant la période.",
        },
        {
            label: "Taux de lecture",
            value: formatPctFr(kpis.readRate.current),
            current: kpis.readRate.current,
            previousValue: kpis.readRate.previous,
            delta: kpis.readRate.deltaPts,
            unit: "pt",
            previous: formatPctFr(kpis.readRate.previous),
            definition:
                "Part des messages sortants de la période actuellement marqués comme lus. Les accusés peuvent arriver plus tard.",
        },
        {
            label: "Part des envois IA",
            value: formatPctFr(kpis.aiAutonomy.current),
            current: kpis.aiAutonomy.current,
            previousValue: kpis.aiAutonomy.previous,
            delta: kpis.aiAutonomy.deltaPts,
            unit: "pt",
            previous: formatPctFr(kpis.aiAutonomy.previous),
            definition:
                "Part des messages sortants envoyés par le bot. Ce n’est pas un taux de résolution autonome.",
        },
    ];

    return (
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border @3xl:grid-cols-3 @6xl:grid-cols-6">
            {items.map((item) => (
                <div key={item.label} className="min-w-0 bg-card p-3 sm:p-4">
                    <div className="flex items-center justify-between gap-1">
                        <p className="truncate text-xs text-muted-foreground">
                            {item.label}
                        </p>

                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-xs"
                                    className="-my-1 -mr-1 shrink-0 text-muted-foreground"
                                    aria-label={`Définition : ${item.label}`}
                                >
                                    <Info aria-hidden="true" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-3 text-xs leading-relaxed text-muted-foreground">
                                {item.definition}
                            </PopoverContent>
                        </Popover>
                    </div>

                    <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums">
                        {item.value}
                    </p>

                    <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                        <Delta
                            value={item.delta}
                            unit={item.unit}
                            current={item.current}
                            previous={item.previousValue}
                        />
                        <span>
                            {item.previousValue === null
                                ? "Aucune donnée"
                                : `vs ${item.previous}`}
                            <span className="sr-only"> sur la période précédente</span>
                        </span>
                    </p>
                </div>
            ))}
        </div>
    );
}
