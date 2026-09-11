import type { DiscussionPoint } from "@/lib/analytics";
import { AnalyticsTimeChart } from "./analytics-time-chart";

interface AnalyticsDiscussionsChartProps {
    data: DiscussionPoint[];
    rangeLabel: string;
}

export function AnalyticsDiscussionsChart({
    data,
    rangeLabel,
}: AnalyticsDiscussionsChartProps) {
    return (
        <AnalyticsTimeChart
            title="Nouveaux contacts"
            description={`Contacts créés · ${rangeLabel}`}
            data={data}
            kind="bar"
            metrics={[
                {
                    key: "count",
                    label: "Nouveaux contacts",
                    color: "var(--chart-3)",
                },
            ]}
            emptyTitle="Aucun nouveau contact"
            emptyDescription="Les contacts créés pendant la période apparaîtront ici, indépendamment de l’activité des contacts existants."
        />
    );
}