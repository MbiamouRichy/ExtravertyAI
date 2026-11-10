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
	dateLabel: string; // ex: "Lun", "12/04", "Janv"
	messages: number;
};

interface MessagesChartProps {
	title?: string;
	description?: string;
	data: ChartDataPoint[];
	growthPct: number;
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
				hasData && (
					<Delta value={Number(growthPct)} className="text-xs font-medium">
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
							interval="preserveStartEnd" // Évite que les labels se chevauchent sur 30 jours
							tickFormatter={(value) => String(value)}
							tickLine={false}
							tickMargin={10}
							minTickGap={20}
						/>
						<ChartTooltip content={<ChartTooltipContent hideLabel />} cursor={false} />
						<Bar dataKey="messages" fill="var(--color-messages)" radius={[4, 4, 0, 0]} maxBarSize={40} />
					</BarChart>
				</ChartContainer>
			)}
		</AnalyticsCard>
	);
}
