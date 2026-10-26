import {
    ArrowDownLeft,
    ArrowDownRight,
    ArrowUpRight,
    Bot,
    CheckCheck,
    Info,
    Minus,
    UserPlus,
    Users,
    type LucideIcon,
} from "lucide-react";

import { Card } from "@/components/ui/card";
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
    icon: LucideIcon;
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
                className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
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
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                rounded === 0
                    ? "bg-muted text-muted-foreground"
                    : "bg-foreground text-background",
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
            icon: ArrowDownLeft,
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
            icon: ArrowUpRight,
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
            icon: UserPlus,
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
            icon: Users,
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
            icon: CheckCheck,
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
            icon: Bot,
        },
    ];

    return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
            {items.map((item) => (
                <Card
                    key={item.label}
                    className="flex min-w-0 flex-col gap-0 rounded-2xl border-border/70 bg-card p-4 shadow-sm"
                >
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-muted-foreground">
                            {item.label}
                        </p>

                        <item.icon
                            aria-hidden="true"
                            className="size-4 shrink-0 text-muted-foreground"
                            strokeWidth={1.7}
                        />
                    </div>

                    <div className="mt-4 flex items-end justify-between gap-2">
                        <p className="text-3xl font-semibold tracking-tight tabular-nums">
                            {item.value}
                        </p>
                        <span className="mb-1 shrink-0">
                            <Delta
                                value={item.delta}
                                unit={item.unit}
                                current={item.current}
                                previous={item.previousValue}
                            />
                        </span>
                    </div>

                    <p className="mt-2 text-xs text-muted-foreground">
                        {item.previousValue === null
                            ? "Aucune donnée sur la période précédente"
                            : `vs ${item.previous} sur la période précédente`}
                    </p>

                    <details className="mt-3 border-t border-border/60 pt-3 text-xs">
                        <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                            <Info aria-hidden="true" className="size-3.5" />
                            Définition
                        </summary>

                        <p className="mt-2 leading-relaxed text-muted-foreground">
                            {item.definition}
                        </p>
                    </details>
                </Card>
            ))}
        </div>
    );
}