import { BillingHealth } from "@/components/dashboard/billing-health";
import { ChannelSalesChart } from "@/components/dashboard/channel-sales-chart";
import { DashboardActivity } from "@/components/dashboard/dashboard-activity";
import { DashboardContacts } from "@/components/dashboard/dashboard-contacts";

import { DashboardStats } from "@/components/dashboard/stats";
import { TeamOnDuty } from "./team-and-duty";
import { SourceDatum } from "@/app/actions/getMessagesSources";
import { SourceMessageChart } from "./source-chart";
import { DashboardMessageRecu } from "./dashboard-message-stats";

export async function Dashboard({ projectId }: { projectId: string }) {
	// const statsResult = await getMessageSourcesStats(projectId, "7d");
	return (
		<div className="grid grid-cols-1 gap-px bg-border p-px m-4 md:m-6 md:grid-cols-2 lg:grid-cols-4">
			<DashboardStats projectId={projectId} />
			<DashboardMessageRecu projectId={projectId} />
			<ChannelSalesChart />
			<DashboardContacts projectId={projectId} />
			<SourceMessageChart
				data={mockData1Month}
				totalMessages={mockTotal1Month}
				trendPercentage={14.2}
			/>
			<BillingHealth />
			<DashboardActivity />
			<TeamOnDuty />
		</div>
	);
}


// --- Mock pour 7 Jours (Trafic faible, forte utilisation IA) ---
export const mockData7Days: SourceDatum[] = [
	{ source: "android", count: 145, fill: "var(--chart-1)" },
	{ source: "ios", count: 89, fill: "var(--chart-2)" },
	{ source: "ai", count: 312, fill: "var(--chart-3)" },
	{ source: "unknown", count: 12, fill: "var(--chart-4)" },
];
export const mockTotal7Days = 558;

// --- Mock pour 1 Mois (Croissance d'Android) ---
export const mockData1Month: SourceDatum[] = [
	{ source: "android", count: 1250, fill: "var(--chart-1)" },
	{ source: "ios", count: 980, fill: "var(--chart-2)" },
	{ source: "ai", count: 1800, fill: "var(--chart-3)" },
	{ source: "unknown", count: 45, fill: "var(--chart-4)" },
];
export const mockTotal1Month = 4075;

// --- Mock pour 1 An (Volume massif) ---
export const mockData1Year: SourceDatum[] = [
	{ source: "android", count: 15420, fill: "var(--chart-1)" },
	{ source: "ios", count: 11200, fill: "var(--chart-2)" },
	{ source: "ai", count: 24500, fill: "var(--chart-3)" },
	{ source: "unknown", count: 310, fill: "var(--chart-4)" },
];
export const mockTotal1Year = 51430;

// --- Cas critique : 0 Messages (Pour tester l'Empty State) ---
export const mockDataEmpty: SourceDatum[] = [
	{ source: "android", count: 0, fill: "var(--chart-1)" },
	{ source: "ios", count: 0, fill: "var(--chart-2)" },
	{ source: "ai", count: 0, fill: "var(--chart-3)" },
	{ source: "unknown", count: 0, fill: "var(--chart-4)" },
];
export const mockTotalEmpty = 0;