"use client";

import { MessageSquareText } from "lucide-react";
import { Bar, BarChart, XAxis } from "recharts";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import { Delta, DeltaIcon, DeltaValue } from "@/components/delta";
import { AnalyticsCard } from "./analytics-card";
import { ChartEmptyState } from "./chart-empty-state";

// On définit le format des données attendues
export type ChartDataPoint = {
	date: string; // jour civil AAAA-MM-JJ
	dateLabel: string; // ex: "lun."
	messages: number;
};

const tooltipDate = new Intl.DateTimeFormat("fr-FR", {
	weekday: "long",
	day: "numeric",
	month: "long",
	timeZone: "UTC",
});

interface MessagesChartProps {
	title?: string;
	description?: string;
	data: ChartDataPoint[];
	/** null : aucune base de comparaison la semaine précédente. */
	growthPct: number | null;
	className?: string;
}

const chartConfig = {
	messages: {
		label: "Messages reçus",
		color: "var(--chart-1)",
	},
} satisfies ChartConfig;

export function MessagesChart({
	title = "Messages reçus",
	description = "Volume de messages entrants.",
	data,
	growthPct,
	className,
}: MessagesChartProps) {
	const hasData = data.some((point) => point.messages > 0);

	return (
		<AnalyticsCard
			title={title}
			description={description}
			className={className}
			aside={
				hasData && growthPct !== null && (
					<Delta value={growthPct} className="text-xs font-medium">
						<DeltaIcon variant="trend" />
						<DeltaValue />
					</Delta>
				)
			}
		>
			{!hasData ? (
				<ChartEmptyState
					icon={MessageSquareText}
					title="Aucun message reçu"
					description="Les messages de vos clients apparaîtront ici."
					className="h-56 sm:h-64"
				/>
			) : (
				<ChartContainer className="aspect-auto h-56 w-full sm:h-64" config={chartConfig}>
					<BarChart accessibilityLayer data={data}>
						<XAxis
							axisLine={false}
							dataKey="dateLabel"
							interval={0}
							tickLine={false}
							tickMargin={10}
						/>
						<ChartTooltip
							cursor={false}
							content={
								<ChartTooltipContent
									labelFormatter={(_, payload) => {
										const date = payload?.[0]?.payload?.date;
										return typeof date === "string"
											? tooltipDate.format(new Date(`${date}T12:00:00.000Z`))
											: "";
									}}
								/>
							}
						/>
						<Bar dataKey="messages" fill="var(--color-messages)" radius={[4, 4, 0, 0]} maxBarSize={40} />
					</BarChart>
				</ChartContainer>
			)}
		</AnalyticsCard>
	);
}
