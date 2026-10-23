import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getAnalyticsAccess } from "@/lib/analytics-access";
import { getAnalyticsOverview } from "@/app/actions/analytics";
import { PERIOD_DAYS, parseAnalyticsPeriod } from "@/lib/analytics";
import prisma from "@/lib/prisma";
import { planAllows } from "@/lib/plan-features";
import { openPipelineValue, wonValue } from "@/lib/pipeline";

import ProjectNotFoundDialog from "@/components/dashboard/project/projectNotfoundDialog";
import { AnalyticsHeader } from "@/components/dashboard/analytics-header";
import { AnalyticsKpiGrid } from "@/components/dashboard/kpi-cards";
import { VolumeChart } from "@/components/dashboard/volume-chart";
import { SourcesChart } from "@/components/dashboard/customSourceMessagesChart";
import { MessageStatusCard } from "@/components/dashboard/message-status-card";
import { TopContactsCard } from "@/components/dashboard/top-contacts-card";
import { AnalyticsMessageRecuChart } from "@/components/dashboard/analytics-message-recu";
import { AnalyticsDiscussionsChart } from "@/components/dashboard/AnalyticsNewDiscussionsChart";
import { RespondersCard } from "@/components/dashboard/responders-card";
import { InstinctFunnelCard } from "@/components/dashboard/instinct-funnel-card";
import { ActivityHeatmapCard } from "@/components/dashboard/activity-heatmap-card";
import { PipelineValueCard } from "@/components/dashboard/pipeline-value-card";
import { CsatCard } from "@/components/dashboard/csat-card";
import { AvoidedRepliesCard } from "@/components/dashboard/avoided-replies-card";
import { FirstAiReplyTimeChart } from "@/components/dashboard/first-reply-time-chart";
import { getAiResponseTimeData } from "@/app/actions/ai-metrics";
import { avoidedReplies } from "@/lib/ai-quiet";
import { csatStats } from "@/lib/csat";

function periodStart(period: keyof typeof PERIOD_DAYS) {
  return new Date(Date.now() - PERIOD_DAYS[period] * 86_400_000);
}

type PageProps = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{
    [key: string]: string | string[] | undefined;
  }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { projectId } = await params;
  const access = await getAnalyticsAccess(projectId);

  if (access.status !== "authorized") {
    return {
      title: "Analytics | ExtravertyAI",
      robots: { index: false, follow: false },
    };
  }

  return {
    title: `${access.projectName} · Analytics | ExtravertyAI`,
    description:
      "Analysez les échanges, les nouveaux contacts et les statuts de vos messages.",
    robots: { index: false, follow: false },
  };
}

export default async function AnalyticsPage({
  params,
  searchParams,
}: PageProps) {
  const [{ projectId }, sp] = await Promise.all([params, searchParams]);

  const access = await getAnalyticsAccess(projectId);
  const projectPath = `/projects/${encodeURIComponent(projectId)}`;

  if (access.status === "unauthenticated") {
    const callbackUrl = `${projectPath}/analytics`;

    redirect(`/sign-in?${new URLSearchParams({ callbackUrl }).toString()}`);
  }

  if (access.status === "not-found") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <ProjectNotFoundDialog open={true} />
      </div>
    );
  }

  if (access.status === "forbidden") {
    redirect(`${projectPath}?error=unauthorized`);
  }

  const period = parseAnalyticsPeriod(sp.period);
  const since = periodStart(period);
  const [overview, sales, avoided, responseTime] = await Promise.all([
    getAnalyticsOverview(projectId, period),
    // L'accès au projet est déjà vérifié ci-dessus ; seule l'offre est relue ici.
    prisma.project
      .findUnique({
        where: { id: projectId },
        select: { plan: true, currency: true, csatEnabled: true },
      })
      .then(async (project) =>
        // Pipeline and satisfaction share the same plans (Pro, Business).
        project && planAllows(project.plan, "pipeline")
          ? {
              currency: project.currency,
              won: await wonValue(prisma, projectId, since),
              open: await openPipelineValue(prisma, projectId),
              csatEnabled: project.csatEnabled,
              csat: await csatStats(prisma, projectId, since),
            }
          : null,
      ),
    // Réponses que l’IA n’a volontairement pas envoyées (toutes offres).
    Promise.all([
      avoidedReplies(prisma, projectId, since),
      prisma.project.findUnique({
        where: { id: projectId },
        select: { aiQuietEnabled: true },
      }),
    ]).then(([stats, project]) => ({
      stats,
      enabled: project?.aiQuietEnabled ?? true,
    })),
    // Délai médian de réponse de l’IA, toujours sur les 7 derniers jours.
    getAiResponseTimeData(projectId),
  ]);

  const sourcesTotal = overview.sources.reduce(
    (sum, source) => sum + source.count,
    0,
  );

  const statusesTotal = overview.statuses.reduce(
    (sum, status) => sum + status.count,
    0,
  );

  return (
    <div className="min-w-0 bg-muted/20">
      <div className="mx-auto flex w-full max-w-400 flex-col gap-6 p-4 sm:p-6 xl:gap-8 xl:p-8">
        <AnalyticsHeader
          projectName={access.projectName}
          period={period}
          rangeLabel={overview.rangeLabel}
          timeZone={overview.timeZone}
          volumeSeries={overview.volumeSeries}
          discussionsSeries={overview.discussionsSeries}
        />

        <section aria-labelledby="analytics-kpis-title">
          <h2 id="analytics-kpis-title" className="sr-only">
            Indicateurs clés
          </h2>

          <AnalyticsKpiGrid kpis={overview.kpis} />
        </section>

        <section
          aria-labelledby="analytics-activity-title"
          className="space-y-4"
        >
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2
                id="analytics-activity-title"
                className="text-base font-semibold tracking-tight"
              >
                Activité & acquisition
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Comprendre le volume et l’origine des échanges.
              </p>
            </div>

            <span className="text-xs text-muted-foreground">
              Heure locale · {overview.timeZone}
            </span>
          </div>

          <div className="grid min-w-0 gap-4 xl:grid-cols-3">
            <div className="min-w-0 xl:col-span-2">
              <VolumeChart
                data={overview.volumeSeries}
                rangeLabel={overview.rangeLabel}
              />
            </div>

            <SourcesChart
              data={overview.sources}
              total={sourcesTotal}
              rangeLabel={overview.rangeLabel}
            />
          </div>

          <div className="grid min-w-0 gap-4 lg:grid-cols-2">
            <AnalyticsMessageRecuChart
              data={overview.volumeSeries}
              rangeLabel={overview.rangeLabel}
            />

            <AnalyticsDiscussionsChart
              data={overview.discussionsSeries}
              rangeLabel={overview.rangeLabel}
            />
          </div>
        </section>

        <section aria-labelledby="analytics-ai-title" className="space-y-4">
          <div>
            <h2
              id="analytics-ai-title"
              className="text-base font-semibold tracking-tight"
            >
              IA & prospects
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Qui répond, qui est intéressé, et à quel moment vos clients écrivent.
            </p>
          </div>

          <div className="grid min-w-0 gap-4 lg:grid-cols-2">
            <RespondersCard
              responders={overview.responders}
              rangeLabel={overview.rangeLabel}
            />
            <InstinctFunnelCard
              instinct={overview.instinct}
              rangeLabel={overview.rangeLabel}
              settingsHref={`${projectPath}/knowledge`}
            />
          </div>

          <div className="grid min-w-0 gap-4 lg:grid-cols-2">
            <FirstAiReplyTimeChart data={responseTime} />
            <AvoidedRepliesCard
              stats={avoided.stats}
              enabled={avoided.enabled}
              rangeLabel={overview.rangeLabel}
              settingsHref={`${projectPath}/knowledge`}
            />
          </div>

          <ActivityHeatmapCard
            heatmap={overview.heatmap}
            rangeLabel={overview.rangeLabel}
            timeZone={overview.timeZone}
          />
        </section>

        {sales && (
          <section aria-labelledby="analytics-sales-title" className="space-y-4">
            <div>
              <h2
                id="analytics-sales-title"
                className="text-base font-semibold tracking-tight"
              >
                Ventes et satisfaction
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Ce que vos conversations rapportent, et ce qu’en pensent vos clients.
              </p>
            </div>
            <div className="grid min-w-0 gap-4 xl:grid-cols-2">
              <PipelineValueCard
                currency={sales.currency}
                won={sales.won}
                open={sales.open}
                rangeLabel={overview.rangeLabel}
                pipelineHref={`${projectPath}/pipeline`}
              />
              <CsatCard
                stats={sales.csat}
                enabled={sales.csatEnabled}
                rangeLabel={overview.rangeLabel}
                settingsHref={`${projectPath}/settings`}
              />
            </div>
          </section>
        )}

        <section
          aria-labelledby="analytics-quality-title"
          className="space-y-4"
        >
          <div>
            <h2
              id="analytics-quality-title"
              className="text-base font-semibold tracking-tight"
            >
              Livraison & contacts
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Suivre les statuts et identifier les contacts actifs.
            </p>
          </div>

          <div className="grid min-w-0 gap-4 xl:grid-cols-3">
            <MessageStatusCard
              statuses={overview.statuses}
              total={statusesTotal}
              rangeLabel={overview.rangeLabel}
            />

            <div className="min-w-0 xl:col-span-2">
              <TopContactsCard
                projectId={projectId}
                contacts={overview.topContacts}
                rangeLabel={overview.rangeLabel}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
