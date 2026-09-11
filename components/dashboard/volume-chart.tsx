import type { VolumePoint } from "@/lib/analytics";
import { AnalyticsTimeChart } from "./analytics-time-chart";

interface VolumeChartProps {
    data: VolumePoint[];
    rangeLabel: string;
}

export function VolumeChart({
    data,
    rangeLabel,
}: VolumeChartProps) {
    return (
        <AnalyticsTimeChart
            title="Volume des échanges"
            description={`Messages entrants et sortants · ${rangeLabel}`}
            data={data}
            metrics={[
                {
                    key: "received",
                    label: "Reçus",
                    color: "var(--chart-1)",
                },
                {
                    key: "sent",
                    label: "Envoyés",
                    color: "var(--chart-2)",
                    dashed: true,
                },
            ]}
            emptyTitle="Aucun échange sur cette période"
            emptyDescription="Essayez une période plus large pour consulter votre historique."
        />
    );
}