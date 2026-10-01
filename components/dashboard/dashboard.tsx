import { DashboardDiscussionsChart } from "@/components/dashboard/new-discussionsChart";
import { DashboardContacts } from "@/components/dashboard/dashboard-contacts";

import { DashboardStats } from "@/components/dashboard/stats";
import { TeamOnDuty } from "./team-and-duty";
import { getMessageSourcesStats } from "@/app/actions/getMessagesSources";
import { SourceMessageChart } from "./source-chart";
import { DashboardMessageRecu } from "./dashboard-message-stats";
import { getAiResponseTimeData } from "@/app/actions/ai-metrics";
import { FirstAiReplyTimeChart } from "./first-reply-time-chart";
import { QuickActions } from "./quick-actions";
import { getDashboardDiscussionsMetrics } from "@/app/actions/getDiscussionsMetrics";
import { getTeamMembers } from "@/app/actions/team";

export async function Dashboard({ projectId }: { projectId: string }) {
	const [statsResult, responseTimeChartData, discussions, teamData] = await Promise.all([
		getMessageSourcesStats(projectId, "7d"),
		getAiResponseTimeData(projectId),
		getDashboardDiscussionsMetrics(projectId),
		getTeamMembers(projectId),
	]);

	return (
		<div className="grid grid-cols-1 gap-4 m-4 md:m-6 md:grid-cols-2 lg:grid-cols-4">
			<DashboardStats projectId={projectId} />
			<DashboardMessageRecu projectId={projectId} />
			<DashboardDiscussionsChart data={discussions.chartData} growthPct={discussions.growthPct} />
			<FirstAiReplyTimeChart className="md:col-span-2" data={responseTimeChartData} />
			<SourceMessageChart
				data={statsResult.data}
				totalMessages={statsResult.totalMessages}
				trendPercentage={statsResult.trendPercentage}
				error={statsResult.success ? undefined : "Impossible de charger les sources des messages."}
			/>
			<TeamOnDuty initialTeammates={teamData} projectId={projectId} />
			<DashboardContacts projectId={projectId} />
			<QuickActions projectId={projectId} />
		</div>
	);
}
