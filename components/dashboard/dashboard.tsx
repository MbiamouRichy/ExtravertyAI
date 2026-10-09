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
  const [statsResult, responseTimeChartData, discussions, teamData] =
    await Promise.all([
      getMessageSourcesStats(projectId, "7d"),
      getAiResponseTimeData(projectId),
      getDashboardDiscussionsMetrics(projectId),
      getTeamMembers(projectId),
    ]);

  return (
    <div className="mx-auto w-full min-w-0 max-w-(--breakpoint-2xl) space-y-5 p-4 md:p-6">
      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 [&>*]:min-w-0">
        <DashboardStats projectId={projectId} />
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-2 [&>*]:min-w-0">
        <DashboardMessageRecu projectId={projectId} />
        <DashboardDiscussionsChart
          data={discussions.chartData}
          growthPct={discussions.growthPct}
        />
      </div>
      <div className="grid min-w-0 grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] [&>*]:min-w-0">
        <FirstAiReplyTimeChart data={responseTimeChartData} />
        <SourceMessageChart
          data={statsResult.data}
          otherSources={statsResult.otherSources}
          totalMessages={statsResult.totalMessages}
          trendPercentage={statsResult.trendPercentage}
          error={
            statsResult.success
              ? undefined
              : "Impossible de charger les sources des messages."
          }
        />
      </div>
      <div className="grid min-w-0 grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] [&>*]:min-w-0">
        <DashboardContacts projectId={projectId} />
        <TeamOnDuty initialTeammates={teamData} projectId={projectId} />
      </div>
      <QuickActions projectId={projectId} />
    </div>
  );
}
