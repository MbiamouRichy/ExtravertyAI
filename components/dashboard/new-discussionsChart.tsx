"use client";

import { useId } from "react";
import { CartesianGrid, Line, LineChart, XAxis } from "recharts";
import {
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
import { DashboardCard } from "@/components/dashboard/dashboard-card";

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
	previousWeek: {
		label: "Semaine dernière",
		color: "var(--chart-2)",
	},
	currentWeek: {
		label: "Cette semaine",
		color: "var(--chart-1)",
	},
} satisfies ChartConfig;

export function DashboardDiscussionsChart({ data, growthPct }: DashboardDiscussionsChartProps) {
	const chartUid = useId().replace(/:/g, "");
	const idLineGlow = `dashboard-discussions-glow-${chartUid}`;

	const hasData = data && data.length > 0;

	return (
		<DashboardCard className="gap-0 md:col-span-2 shadow-sm">
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
					<div className="flex aspect-auto h-60 w-full items-center justify-center text-muted-foreground md:h-80">
						Aucune discussion récente.
					</div>
				) : (
					<ChartContainer
						className="aspect-auto h-60 w-full p-0 md:h-80"
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
							<defs>
								<filter
									height="140%"
									id={idLineGlow}
									width="140%"
									x="-20%"
									y="-20%"
								>
									<feGaussianBlur result="blur" stdDeviation="10" />
									<feComposite in="SourceGraphic" in2="blur" operator="over" />
								</filter>
							</defs>
							<Line
								dataKey="previousWeek"
								dot={false}
								filter={`url(#${idLineGlow})`}
								stroke="var(--color-previousWeek)"
								strokeWidth={2}
								type="step"
								strokeDasharray="4 4"// On garde le tireté pour différencier l'ancienne semaine
							/>
							<Line
								dataKey="currentWeek"
								dot={false}
								filter={`url(#${idLineGlow})`}
								stroke="var(--color-currentWeek)"
								strokeWidth={2}
								type="step"
							/>
						</LineChart>
					</ChartContainer>
				)}
			</CardContent>
		</DashboardCard>
	);
}