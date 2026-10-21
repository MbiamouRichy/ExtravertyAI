"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { MessagesSquare } from "lucide-react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import { Delta, DeltaIcon, DeltaValue } from "@/components/delta";
import { formatNumberFr } from "@/lib/analytics";
import { ChartEmptyState } from "./chart-empty-state";


export type DashboardDiscussionRow = {
	day: string;
	currentWeek: number;
	previousWeek: number;
};

interface DashboardDiscussionsChartProps {
	data: DashboardDiscussionRow[];
	growthPct: number;
}

const chartConfig = {
	currentWeek: {
		label: "Cette semaine",
		color: "var(--chart-1)",
	},
	previousWeek: {
		label: "Semaine dernière",
		color: "var(--chart-3)",
	},
} satisfies ChartConfig;

// Le tireté distingue la semaine précédente sans dépendre de la seule couleur.
const SERIES = [
	{ key: "currentWeek", dashed: false },
	{ key: "previousWeek", dashed: true },
] as const;

export function DashboardDiscussionsChart({ data, growthPct }: DashboardDiscussionsChartProps) {
	const hasData = data.some((row) => row.currentWeek > 0 || row.previousWeek > 0);
	const totals = SERIES.map((serie) => ({
		...serie,
		label: chartConfig[serie.key].label,
		color: chartConfig[serie.key].color,
		total: data.reduce((sum, row) => sum + row[serie.key], 0),
	}));

	return (
		<Card className="gap-0">
			<CardHeader>
				<div className="min-w-0 space-y-2">
					<div className="flex flex-wrap items-center gap-2">
						<CardTitle>Nouvelles discussions</CardTitle>
						{hasData && (
							<Delta value={growthPct} variant="badge">
								<DeltaIcon variant="trend" />
								<DeltaValue />
							</Delta>
						)}
					</div>
					<CardDescription>
						Comparaison des 7 derniers jours avec la période précédente.
					</CardDescription>
				</div>
			</CardHeader>
			<CardContent>
				{!hasData ? (
					<ChartEmptyState
						icon={MessagesSquare}
						title="Aucune discussion récente"
						description="Les nouvelles discussions des deux dernières semaines apparaîtront ici."
						className="h-60 md:h-72"
					/>
				) : (
					<>
						<ul aria-label="Totaux des séries" className="mb-4 flex flex-wrap gap-x-8 gap-y-3">
							{totals.map((serie) => (
								<li key={serie.key}>
									<div className="flex items-center gap-2 text-xs text-muted-foreground">
										<span
											aria-hidden="true"
											className="w-5 border-t-2"
											style={{
												borderColor: serie.color,
												borderTopStyle: serie.dashed ? "dashed" : "solid",
											}}
										/>
										{serie.label}
									</div>
									<p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
										{formatNumberFr(serie.total)}
									</p>
								</li>
							))}
						</ul>
						<ChartContainer
							className="aspect-auto h-56 w-full p-0 md:h-64"
							config={chartConfig}
						>
							<LineChart
								accessibilityLayer
								data={data}
								margin={{ left: 0, right: 12, top: 8, bottom: 0 }}
							>
								<CartesianGrid vertical={false} strokeDasharray="3 5" className="stroke-border/60" />
								<XAxis
									axisLine={false}
									dataKey="day"
									interval={0}
									tickLine={false}
									tickMargin={10}
									fontSize={11}
									padding={{ left: 8, right: 8 }}
								/>
								<YAxis
									axisLine={false}
									tickLine={false}
									allowDecimals={false}
									width={36}
									tickMargin={6}
									tickFormatter={formatNumberFr}
									fontSize={11}
								/>
								<ChartTooltip
									cursor={{ stroke: "var(--border)", strokeDasharray: "4 4" }}
									content={<ChartTooltipContent indicator="line" />}
								/>
								{SERIES.map((serie) => (
									<Line
										key={serie.key}
										dataKey={serie.key}
										type="linear"
										stroke={`var(--color-${serie.key})`}
										strokeWidth={2}
										strokeDasharray={serie.dashed ? "5 4" : undefined}
										dot={false}
										activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }}
										isAnimationActive={false}
									/>
								))}
							</LineChart>
						</ChartContainer>
					</>
				)}
			</CardContent>
		</Card>
	);
}
