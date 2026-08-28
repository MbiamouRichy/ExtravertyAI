import { BillingHealth } from "@/components/billing-health";
import { ChannelSalesChart } from "@/components/dashboard/channel-sales-chart";
import { DashboardActivity } from "@/components/dashboard/dashboard-activity";
import { DashboardInvoices } from "@/components/dashboard/dashboard-invoices";
import { NetRevenueChart } from "@/components/dashboard/net-revenue-chart";
import { DashboardStats } from "@/components/dashboard/stats";
import { ChannelBreakdownChart } from "./chanel-chart";
import { TeamOnDuty } from "./team-and-duty";

export function Dashboard() {
	return (
		<div className="grid grid-cols-1 gap-px bg-border p-px md:grid-cols-2 lg:grid-cols-4">
			<DashboardStats />
			<NetRevenueChart />
			<ChannelSalesChart />
			<DashboardInvoices />
			<ChannelBreakdownChart />
			<BillingHealth />
			<DashboardActivity />
			<TeamOnDuty />
		</div>
	);
}
