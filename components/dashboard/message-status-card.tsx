import { CheckCheck, CircleAlert } from "lucide-react";

import { AnalyticsCard } from "./analytics-card";
import { ChartEmptyState } from "./chart-empty-state";
import { cn } from "@/lib/utils";
import {
    MESSAGE_STATUS_META,
    formatNumberFr,
    formatPctFr,
    type StatusDatum,
} from "@/lib/analytics";

interface MessageStatusCardProps {
    statuses: StatusDatum[];
    total: number;
    rangeLabel: string;
}

export function MessageStatusCard({
    statuses,
    total,
    rangeLabel,
}: MessageStatusCardProps) {
    const failedCount =
        statuses.find((item) => item.status === "FAILED")?.count ?? 0;

    return (
        <AnalyticsCard
            title="Livraison des messages"
            description={`Statuts des messages sortants · ${rangeLabel}`}
            aside={
                <span className="text-xs font-medium tabular-nums text-muted-foreground">
                    {formatNumberFr(total)} sortants
                </span>
            }
            footer="Statut actuellement enregistré pour chaque message créé pendant la période. Les accusés peuvent évoluer."
        >
            {total === 0 ? (
                <ChartEmptyState
                    icon={CheckCheck}
                    title="Aucun message sortant"
                    description="Les statuts apparaîtront dès qu’un message sera envoyé par l’IA ou un agent."
                />
            ) : (
                <div className="space-y-5">
                    <div
                        aria-hidden="true"
                        className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-muted"
                    >
                        {statuses
                            .filter((item) => item.count > 0)
                            .map((item) => (
                                <div
                                    key={item.status}
                                    className={cn(
                                        "h-full",
                                        MESSAGE_STATUS_META[item.status].bar,
                                    )}
                                    style={{
                                        width: `${(item.count / total) * 100}%`,
                                    }}
                                />
                            ))}
                    </div>

                    <ul className="divide-y divide-border/60">
                        {statuses.map(({ status, count }) => {
                            const meta = MESSAGE_STATUS_META[status];

                            return (
                                <li
                                    key={status}
                                    className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                                >
                                    <span className="flex items-center gap-2.5 text-sm">
                                        <span
                                            aria-hidden="true"
                                            className={cn(
                                                "size-2 rounded-full",
                                                meta.bar,
                                            )}
                                        />
                                        {meta.label}
                                    </span>

                                    <div className="text-right">
                                        <p className="text-sm font-medium tabular-nums">
                                            {count.toLocaleString("fr-FR")}
                                        </p>

                                        <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                                            {formatPctFr(
                                                (count / total) * 100,
                                            )}
                                        </p>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>

                    {failedCount > 0 && (
                        <div className="flex gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                            <CircleAlert
                                aria-hidden="true"
                                className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400"
                            />

                            <p className="text-xs leading-relaxed text-amber-900 dark:text-amber-200">
                                {formatNumberFr(failedCount)} message
                                {failedCount > 1 ? "s" : ""} en échec.
                                Consultez les conversations concernées pour
                                identifier la cause.
                            </p>
                        </div>
                    )}
                </div>
            )}
        </AnalyticsCard>
    );
}