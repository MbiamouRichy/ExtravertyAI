"use client";

import { MessagesSquare } from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis } from "recharts";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import { Delta, DeltaIcon, DeltaValue } from "@/components/delta";
import { AnalyticsCard } from "./analytics-card";
import { ChartEmptyState } from "./chart-empty-state";


export type DashboardDiscussionRow = {
	day: string;
	currentWeek: number;
	previousWeek: number;
};

interface DashboardDiscussionsChartProps {
	data: DashboardDiscussionRow[];
	growthPct: number | null;
}

const chartConfig = {
	previousWeek: {
		label: "Semaine dernière",
		color: "var(--chart-4)",
	},
	currentWeek: {
		label: "Cette semaine",
		color: "var(--chart-1)",
	},
} satisfies ChartConfig;

export function DashboardDiscussionsChart({ data, growthPct }: DashboardDiscussionsChartProps) {

	const hasData = data.some((row) => row.currentWeek > 0 || row.previousWeek > 0);

	return (
		<AnalyticsCard
			title="Nouvelles discussions"
			description="Comparées à la semaine précédente"
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
					icon={MessagesSquare}
					title="Aucune discussion récente"
					description="Les nouvelles discussions apparaîtront ici."
					className="h-56 sm:h-64"
				/>
			) : (
				<>
					<ChartContainer
						className="aspect-auto h-52 w-full p-0 sm:h-60"
						config={chartConfig}
					>
						<LineChart
							accessibilityLayer
							data={data}
							margin={{ left: 12, right: 12, top: 8 }}
						>
							<CartesianGrid className="stroke-border" vertical={false} />
							<XAxis
								axisLine={false}
								dataKey="day"
								interval={0}
								tickLine={false}
								tickMargin={8}
							/>
							<ChartTooltip
								content={<ChartTooltipContent hideLabel />}
								cursor={false}
							/>
							<Line
								dataKey="previousWeek"
								dot={false}
								stroke="var(--color-previousWeek)"
								strokeWidth={2}
								type="monotone"
							/>
							<Line
								dataKey="currentWeek"
								dot={false}
								stroke="var(--color-currentWeek)"
								strokeWidth={2}
								type="monotone"
							/>
						</LineChart>
					</ChartContainer>
					<ul className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
						{(["currentWeek", "previousWeek"] as const).map((key) => (
							<li key={key} className="flex items-center gap-1.5">
								<span
									aria-hidden="true"
									className="size-2 rounded-full"
									style={{ backgroundColor: chartConfig[key].color }}
								/>
								{chartConfig[key].label}
							</li>
						))}
					</ul>
				</>
			)}
		</AnalyticsCard>
	);
}
