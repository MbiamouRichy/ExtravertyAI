"use client";

import { Bar, BarChart, XAxis } from "recharts";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import { Delta, DeltaIcon, DeltaValue } from "@/components/delta";
import { AnalyticsCard } from "./analytics-card";

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
	return (
		<AnalyticsCard
			title={title}
			description={description}
			className={className}
			aside={
				<Delta value={Number(growthPct)} className="text-xs font-medium">
					<DeltaIcon variant="trend" />
					<DeltaValue />
				</Delta>
			}
		>
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
		</AnalyticsCard>
	);
}
