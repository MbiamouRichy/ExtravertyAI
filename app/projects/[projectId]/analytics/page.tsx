import type { ReactNode } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getAnalyticsAccess } from "@/lib/analytics-access";
import { can, homePath } from "@/lib/project-permissions";
import { getAnalyticsOverview } from "@/app/actions/analytics";
import {
  PERIOD_DAYS,
  clampAnalyticsPeriod,
  parseAnalyticsPeriod,
} from "@/lib/analytics";
import prisma from "@/lib/prisma";
import { minimumPlanFor, planAllows } from "@/lib/plan-features";
import { pricingPlan } from "@/lib/pricing";
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
import {
  PipelineValueCard,
  PipelineValueLockedCard,
} from "@/components/dashboard/pipeline-value-card";
import { CsatCard } from "@/components/dashboard/csat-card";
import { AvoidedRepliesCard } from "@/components/dashboard/avoided-replies-card";
import { FirstAiReplyTimeChart } from "@/components/dashboard/first-reply-time-chart";
import { getAiResponseTimeData } from "@/app/actions/ai-metrics";
import { avoidedReplies } from "@/lib/ai-quiet";
import { csatStats } from "@/lib/csat";

function periodStart(period: keyof typeof PERIOD_DAYS) {
  return new Date(Date.now() - PERIOD_DAYS[period] * 86_400_000);
}

function AnalyticsSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <h2 id={id} className="text-sm font-medium text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
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
    redirect(homePath(projectId, access.role));
  }

  // Une période hors offre (lien partagé, URL modifiée) revient au maximum autorisé.
  const period = clampAnalyticsPeriod(
    parseAnalyticsPeriod(sp.period),
    access.analyticsDays,
  );
  const since = periodStart(period);
  const [overview, sales, avoided, responseTime] = await Promise.all([
    getAnalyticsOverview(projectId, period),
    // L'accès au projet est déjà vérifié ci-dessus ; seule l'offre est relue ici.
    prisma.project
      .findUnique({
        where: { id: projectId },
        select: { plan: true, currency: true, csatEnabled: true },
      })
      .then(async (project) => {
        // Satisfaction dès Pro, pipeline de ventes avec Business seulement.
        if (!project || !planAllows(project.plan, "csat")) return null;
        const [pipeline, csat] = await Promise.all([
          planAllows(project.plan, "pipeline")
            ? Promise.all([
                wonValue(prisma, projectId, since),
                openPipelineValue(prisma, projectId),
              ]).then(([won, open]) => ({ currency: project.currency, won, open }))
            : null,
          csatStats(prisma, projectId, since),
        ]);
        return { pipeline, csatEnabled: project.csatEnabled, csat };
      }),
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
    <div className="@container min-w-0">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 p-4 sm:p-6 lg:p-8">
        <AnalyticsHeader
          projectName={access.projectName}
          period={period}
          plan={access.plan}
          analyticsDays={access.analyticsDays}
          billingHref={`${projectPath}/billing`}
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

        <AnalyticsSection id="analytics-activity-title" title="Activité & acquisition">
          <div className="grid min-w-0 gap-4 @3xl:grid-cols-2 @5xl:grid-cols-6">
            <div className="min-w-0 @3xl:col-span-2 @5xl:col-span-4">
              <VolumeChart
                data={overview.volumeSeries}
                rangeLabel={overview.rangeLabel}
              />
            </div>

            <div className="min-w-0 @3xl:col-span-2">
              <SourcesChart
                data={overview.sources}
                total={sourcesTotal}
                rangeLabel={overview.rangeLabel}
              />
            </div>

            <div className="min-w-0 @5xl:col-span-3">
              <AnalyticsMessageRecuChart
                data={overview.volumeSeries}
                rangeLabel={overview.rangeLabel}
              />
            </div>

            <div className="min-w-0 @5xl:col-span-3">
              <AnalyticsDiscussionsChart
                data={overview.discussionsSeries}
                rangeLabel={overview.rangeLabel}
              />
            </div>
          </div>
        </AnalyticsSection>

        <AnalyticsSection id="analytics-ai-title" title="IA & prospects">
          <div className="grid min-w-0 gap-4 @3xl:grid-cols-2">
            <RespondersCard
              responders={overview.responders}
              rangeLabel={overview.rangeLabel}
            />
            <InstinctFunnelCard
              instinct={overview.instinct}
              rangeLabel={overview.rangeLabel}
              settingsHref={`${projectPath}/knowledge`}
              locked={
                planAllows(access.plan, "instinct")
                  ? undefined
                  : {
                      planName: pricingPlan(minimumPlanFor("instinct")).name,
                      upgradeHref: can(access.role, "billing.manage")
                        ? `${projectPath}/billing`
                        : null,
                    }
              }
            />
            <FirstAiReplyTimeChart data={responseTime} />
            <AvoidedRepliesCard
              stats={avoided.stats}
              enabled={avoided.enabled}
              rangeLabel={overview.rangeLabel}
              settingsHref={`${projectPath}/knowledge`}
            />
            <div className="min-w-0 @3xl:col-span-2">
              <ActivityHeatmapCard
                heatmap={overview.heatmap}
                rangeLabel={overview.rangeLabel}
                timeZone={overview.timeZone}
              />
            </div>
          </div>
        </AnalyticsSection>

        {sales && (
          <AnalyticsSection id="analytics-sales-title" title="Ventes et satisfaction">
            <div className="grid min-w-0 gap-4 @5xl:grid-cols-2">
              {sales.pipeline ? (
                <PipelineValueCard
                  currency={sales.pipeline.currency}
                  won={sales.pipeline.won}
                  open={sales.pipeline.open}
                  rangeLabel={overview.rangeLabel}
                  pipelineHref={`${projectPath}/pipeline`}
                />
              ) : (
                <PipelineValueLockedCard
                  planName={pricingPlan(minimumPlanFor("pipeline")).name}
                  upgradeHref={can(access.role, "billing.manage") ? `${projectPath}/billing` : null}
                />
              )}
              <CsatCard
                stats={sales.csat}
                enabled={sales.csatEnabled}
                rangeLabel={overview.rangeLabel}
                settingsHref={`${projectPath}/settings`}
              />
            </div>
          </AnalyticsSection>
        )}

        <AnalyticsSection id="analytics-quality-title" title="Livraison & contacts">
          {/* Pleine largeur : le tableau triable des contacts a besoin de place. */}
          <div className="grid min-w-0 gap-4">
            <MessageStatusCard
              statuses={overview.statuses}
              total={statusesTotal}
              rangeLabel={overview.rangeLabel}
            />
            <TopContactsCard
              projectId={projectId}
              contacts={overview.topContacts}
              rangeLabel={overview.rangeLabel}
            />
          </div>
        </AnalyticsSection>
      </div>
    </div>
  );
}
