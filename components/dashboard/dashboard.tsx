import Link from "next/link";
import { BarChart3, MessagesSquare, Pause } from "lucide-react";

import { DashboardDiscussionsChart } from "@/components/dashboard/new-discussionsChart";
import { DashboardContacts } from "@/components/dashboard/dashboard-contacts";
import { DashboardStats } from "@/components/dashboard/stats";
import { WhatsAppConnectionStatus } from "@/components/dashboard/project/whatsapp-connection-status";
import { Button } from "@/components/ui/button";
import { TeamOnDuty } from "./team-and-duty";
import { getMessageSourcesStats } from "@/app/actions/getMessagesSources";
import { SourceMessageChart } from "./source-chart";
import { DashboardMessageRecu } from "./dashboard-message-stats";
import { getAiResponseTimeData } from "@/app/actions/ai-metrics";
import { FirstAiReplyTimeChart } from "./first-reply-time-chart";
import { QuickActions } from "./quick-actions";
import { getDashboardDiscussionsMetrics } from "@/app/actions/getDiscussionsMetrics";
import { getTeamMembers } from "@/app/actions/team";
import { can } from "@/lib/project-permissions";

function SectionTitle({ id, title }: { id: string; title: string }) {
  return (
    <h2 id={id} className="mb-3 text-sm font-medium text-muted-foreground">
      {title}
    </h2>
  );
}

export async function Dashboard({
  projectId,
  role,
  project,
}: {
  projectId: string;
  role: string;
  project: { name: string; instanceStatus: string | null; automationPaused: boolean };
}) {
  const canOpenChat = can(role, "conversations.handle");
  // Les derniers prospects montrent les numéros : pas pour un lecteur.
  const canSeeContacts = can(role, "contacts.view");
  const [statsResult, responseTimeChartData, discussions, teamData] =
    await Promise.all([
      getMessageSourcesStats(projectId, "7d"),
      getAiResponseTimeData(projectId),
      getDashboardDiscussionsMetrics(projectId),
      getTeamMembers(projectId),
    ]);
  const base = `/projects/${encodeURIComponent(projectId)}`;

  return (
    <div className="@container min-w-0">
      <div className="mx-auto w-full max-w-7xl space-y-8 p-4 sm:p-6 lg:p-8">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">Tableau de bord</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="min-w-0 truncate">{project.name}</span>
              <WhatsAppConnectionStatus status={project.instanceStatus} compact />
              {project.automationPaused && (
                <span className="inline-flex items-center gap-1.5 text-xs">
                  <Pause aria-hidden="true" className="size-3.5" />
                  Automatisation en pause
                </span>
              )}
            </div>
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex">
            <Button asChild variant="outline" className="min-w-0">
              <Link href={`${base}/analytics`}>
                <BarChart3 data-icon="inline-start" />
                <span className="truncate">Statistiques</span>
              </Link>
            </Button>
            {canOpenChat && (
              <Button asChild className="min-w-0">
                <Link href={`${base}/chat`}>
                  <MessagesSquare data-icon="inline-start" />
                  <span className="truncate">Messagerie</span>
                </Link>
              </Button>
            )}
          </div>
        </header>

        <section aria-labelledby="overview-title">
          <SectionTitle id="overview-title" title="7 derniers jours" />
          <DashboardStats projectId={projectId} />
        </section>

        <section aria-labelledby="activity-title">
          <SectionTitle id="activity-title" title="Activité" />
          <div className="space-y-4">
            <div className="grid min-w-0 grid-cols-1 gap-4 @4xl:grid-cols-2 [&>*]:min-w-0">
              <DashboardMessageRecu projectId={projectId} />
              <DashboardDiscussionsChart data={discussions.chartData} growthPct={discussions.growthPct} />
            </div>
            <div className="grid min-w-0 grid-cols-1 gap-4 @4xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] [&>*]:min-w-0">
              <FirstAiReplyTimeChart data={responseTimeChartData} />
              <SourceMessageChart
                data={statsResult.data}
                otherSources={statsResult.otherSources}
                totalMessages={statsResult.totalMessages}
                trendPercentage={statsResult.trendPercentage}
                error={statsResult.success ? undefined : "Impossible de charger les sources des messages."}
              />
            </div>
          </div>
        </section>

        <section aria-labelledby="people-title">
          <SectionTitle id="people-title" title={canSeeContacts ? "Contacts et équipe" : "Équipe"} />
          <div
            className={
              canSeeContacts
                ? "grid min-w-0 grid-cols-1 gap-4 @4xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] [&>*]:min-w-0"
                : "grid min-w-0 max-w-xl grid-cols-1 gap-4 [&>*]:min-w-0"
            }
          >
            {canSeeContacts && <DashboardContacts projectId={projectId} />}
            <TeamOnDuty
              initialTeammates={teamData}
              projectId={projectId}
              canDispatch={can(role, "conversations.dispatch")}
              canManageTeam={can(role, "team.manage")}
            />
          </div>
        </section>

        <section aria-labelledby="actions-title">
          <SectionTitle id="actions-title" title="Actions rapides" />
          <QuickActions projectId={projectId} role={role} />
        </section>
      </div>
    </div>
  );
}
