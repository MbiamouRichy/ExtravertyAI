import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getAnalyticsAccess } from "@/lib/analytics-access";
import { getAnalyticsOverview } from "@/app/actions/analytics";
import { parseAnalyticsPeriod } from "@/lib/analytics";

import ProjectNotFoundDialog from "@/components/dashboard/project/projectNotfoundDialog";
import { AnalyticsHeader } from "@/components/dashboard/analytics-header";
import { AnalyticsKpiGrid } from "@/components/dashboard/kpi-cards";
import { VolumeChart } from "@/components/dashboard/volume-chart";
import { SourcesChart } from "@/components/dashboard/customSourceMessagesChart";
import { MessageStatusCard } from "@/components/dashboard/message-status-card";
import { TopContactsCard } from "@/components/dashboard/top-contacts-card";
import { AnalyticsMessageRecuChart } from "@/components/dashboard/analytics-message-recu";
import { AnalyticsDiscussionsChart } from "@/components/dashboard/AnalyticsNewDiscussionsChart";

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
    const [{ projectId }, sp] = await Promise.all([
        params,
        searchParams,
    ]);

    const access = await getAnalyticsAccess(projectId);
    const projectPath = `/projects/${encodeURIComponent(projectId)}`;

    if (access.status === "unauthenticated") {
        const callbackUrl = `${projectPath}/analytics`;

        redirect(
            `/sign-in?${new URLSearchParams({ callbackUrl }).toString()}`,
        );
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
    const overview = await getAnalyticsOverview(projectId, period);

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
            <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 p-4 sm:p-6 xl:gap-8 xl:p-8">
                <AnalyticsHeader
                    projectName={access.projectName}
                    period={period}
                    rangeLabel={overview.rangeLabel}
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
                            Regroupements en UTC
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
                                contacts={overview.topContacts}
                                rangeLabel={overview.rangeLabel}
                            />
                        </div>
                    </div>
                </section>

                <p className="text-xs leading-relaxed text-muted-foreground">
                    Fenêtre glissante. Les premiers et derniers regroupements
                    peuvent être partiels. Les évolutions comparent une période
                    précédente de même durée.
                </p>
            </div>
        </div>
    );
}