import type { VolumePoint } from "@/lib/analytics";
import { AnalyticsTimeChart } from "./analytics-time-chart";

interface AnalyticsMessageRecuChartProps {
    data: VolumePoint[];
    rangeLabel: string;
}

export function AnalyticsMessageRecuChart({
    data,
    rangeLabel,
}: AnalyticsMessageRecuChartProps) {
    return (
        <AnalyticsTimeChart
            title="Messages reçus"
            description={`Détail du volume entrant · ${rangeLabel}`}
            data={data}
            kind="bar"
            metrics={[
                {
                    key: "received",
                    label: "Messages clients",
                    color: "var(--chart-1)",
                },
            ]}
            emptyTitle="Aucun message reçu"
            emptyDescription="Les messages de vos clients apparaîtront ici. Vous pouvez aussi élargir la période."
        />
    );
}