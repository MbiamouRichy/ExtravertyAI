"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Inbox } from "lucide-react";
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
	className = "gap-0 ",
}: MessagesChartProps) {
	const total = data.reduce((sum, point) => sum + point.messages, 0);

	return (
		<Card className={className}>
			<CardHeader className="gap-2">
				<div className="flex flex-wrap items-center gap-2">
					<CardTitle>{title}</CardTitle>
					{total > 0 && (
						<Delta value={Number(growthPct)} variant="badge">
							<DeltaIcon variant="trend" />
							<DeltaValue />
						</Delta>
					)}
				</div>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			<CardContent>
				{total === 0 ? (
					<ChartEmptyState
						icon={Inbox}
						title="Aucun message reçu"
						description="Les messages de vos clients des 7 derniers jours apparaîtront ici."
						className="h-60 md:h-72"
					/>
				) : (
					<>
						<p className="mb-4 text-2xl font-semibold tracking-tight tabular-nums">
							{formatNumberFr(total)}
							<span className="ml-2 text-xs font-normal text-muted-foreground">
								au total
							</span>
						</p>
						<ChartContainer className="aspect-auto h-56 w-full md:h-64" config={chartConfig}>
							<BarChart
								accessibilityLayer
								data={data}
								margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
								barCategoryGap="28%"
							>
								<CartesianGrid vertical={false} strokeDasharray="3 5" className="stroke-border/60" />
								<XAxis
									axisLine={false}
									dataKey="dateLabel"
									interval="preserveStartEnd"
									tickLine={false}
									tickMargin={10}
									minTickGap={20}
									fontSize={11}
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
									cursor={{ fill: "var(--muted)", opacity: 0.6 }}
									content={<ChartTooltipContent />}
								/>
								<Bar
									dataKey="messages"
									fill="var(--color-messages)"
									radius={[4, 4, 0, 0]}
									maxBarSize={36}
									isAnimationActive={false}
								/>
							</BarChart>
						</ChartContainer>
					</>
				)}
			</CardContent>
		</Card>
	);
}
