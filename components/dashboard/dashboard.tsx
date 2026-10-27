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

function SectionTitle({ id, title, description }: { id: string; title: string; description: string }) {
  return (
    <div className="mb-4">
      <h2 id={id} className="font-heading text-lg font-semibold tracking-tight">
        {title}
      </h2>
      <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
    </div>
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
    <div className="mx-auto w-full min-w-0 max-w-(--breakpoint-2xl) space-y-8 p-4 md:p-6 xl:p-8">
      <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div className="min-w-0">
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Tableau de bord
          </p>
          <h1 className="mt-1 truncate text-3xl md:text-4xl">{project.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
            <WhatsAppConnectionStatus status={project.instanceStatus} />
            {project.automationPaused && (
              <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs">
                <Pause aria-hidden="true" className="size-3.5" />
                Automatisation en pause
              </span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Button asChild variant="outline" className="min-w-0">
            <Link href={`${base}/analytics`}>
              <BarChart3 data-icon="inline-start" />
              <span className="truncate">
                <span className="sm:hidden">Statistiques</span>
                <span className="hidden sm:inline">Statistiques détaillées</span>
              </span>
            </Link>
          </Button>
          {canOpenChat && (
            <Button asChild className="min-w-0">
              <Link href={`${base}/chat`}>
                <MessagesSquare data-icon="inline-start" />
                <span className="truncate">
                  <span className="sm:hidden">Messagerie</span>
                  <span className="hidden sm:inline">Ouvrir la messagerie</span>
                </span>
              </Link>
            </Button>
          )}
        </div>
      </header>

      <section aria-labelledby="overview-title">
        <SectionTitle id="overview-title" title="Vue d’ensemble" description="Les indicateurs clés de votre projet." />
        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 [&>*]:min-w-0">
          <DashboardStats projectId={projectId} />
        </div>
      </section>

      <section aria-labelledby="activity-title">
        <SectionTitle
          id="activity-title"
          title="Activité"
          description="Messages reçus, nouvelles discussions et réactivité de l’assistant."
        />
        <div className="space-y-5">
          <div className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-2 [&>*]:min-w-0">
            <DashboardMessageRecu projectId={projectId} />
            <DashboardDiscussionsChart data={discussions.chartData} growthPct={discussions.growthPct} />
          </div>
          <div className="grid min-w-0 grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] [&>*]:min-w-0">
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
        <SectionTitle
          id="people-title"
          title={canSeeContacts ? "Contacts et équipe" : "Équipe"}
          description={
            canSeeContacts
              ? "Vos derniers prospects et qui est disponible."
              : "Qui est disponible et combien de conversations chacun suit."
          }
        />
        <div
          className={
            canSeeContacts
              ? "grid min-w-0 grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] [&>*]:min-w-0"
              : "grid min-w-0 grid-cols-1 items-start gap-5 xl:max-w-xl [&>*]:min-w-0"
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
        <SectionTitle id="actions-title" title="Actions rapides" description="Accédez directement aux outils de votre projet." />
        <QuickActions projectId={projectId} role={role} />
      </section>
    </div>
  );
}
