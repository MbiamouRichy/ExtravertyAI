import {
    ArrowDownLeft,
    ArrowUpRight,
    Bot,
    CheckCheck,
    Info,
    Minus,
    TrendingDown,
    TrendingUp,
    UserPlus,
    Users,
    type LucideIcon,
} from "lucide-react";

import { Card } from "@/components/ui/card";
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
    delta: number | null;
    unit: "%" | "pt";
    previous: string;
    definition: string;
    icon: LucideIcon;
}

function Delta({
    value,
    unit,
}: {
    value: number | null;
    unit: "%" | "pt";
}) {
    if (value === null || !Number.isFinite(value)) {
        return (
            <span className="text-xs text-muted-foreground">
                Comparaison indisponible
            </span>
        );
    }

    const rounded = Math.round(value * 10) / 10;
    const Icon =
        rounded > 0 ? TrendingUp : rounded < 0 ? TrendingDown : Minus;

    const label = new Intl.NumberFormat("fr-FR", {
        maximumFractionDigits: 1,
        signDisplay: "exceptZero",
    }).format(rounded);

    return (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs font-medium tabular-nums">
            <Icon aria-hidden="true" className="size-3.5" />
            {label} {unit}
        </span>
    );
}

export function AnalyticsKpiGrid({ kpis }: AnalyticsKpiGridProps) {
    const items: KpiItem[] = [
        {
            label: "Messages reçus",
            value: formatNumberFr(kpis.received.current),
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

                    <p className="mt-4 text-3xl font-semibold tracking-tight tabular-nums">
                        {item.value}
                    </p>

                    <div className="mt-3 flex min-h-7 items-center">
                        <Delta value={item.delta} unit={item.unit} />
                    </div>

                    <p className="mt-2 text-xs text-muted-foreground">
                        Précédent : {item.previous}
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