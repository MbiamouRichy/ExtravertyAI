import { BillingHealth } from "@/components/dashboard/billing-health";
import { ChannelSalesChart } from "@/components/dashboard/channel-sales-chart";
import { DashboardActivity } from "@/components/dashboard/dashboard-activity";
import { DashboardContacts } from "@/components/dashboard/dashboard-contacts";
import { NetRevenueChart } from "@/components/dashboard/net-revenue-chart";
import { DashboardStats } from "@/components/dashboard/stats";
import { ChannelBreakdownChart } from "./chanel-chart";
import { TeamOnDuty } from "./team-and-duty";

export function Dashboard() {
	const projectId = "1"; // Remplacez par l'ID réel du projet ou récupérez-le dynamiquement si nécessaire
	return (
		<div className="grid grid-cols-1 gap-px bg-border p-px m-4 md:m-6 md:grid-cols-2 lg:grid-cols-4">
			<DashboardStats />
			<NetRevenueChart />
			<ChannelSalesChart />
			<DashboardContacts projectId={projectId} />
			<ChannelBreakdownChart />
			<BillingHealth />
			<DashboardActivity />
			<TeamOnDuty />
		</div>
	);
}
