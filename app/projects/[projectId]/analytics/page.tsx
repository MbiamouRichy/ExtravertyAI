import { getSession } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import { Metadata } from "next";
import prisma from "@/lib/prisma";
import { AnalyticsMessageRecuChart } from "@/components/dashboard/analytics-message-recu";
import { CustomSourceMessageChart } from "@/components/dashboard/customSourceMessagesChart";
import { getMessageSourcesStats } from "@/app/actions/getMessagesSources";
import { AnalyticsDiscussionsChart } from "@/components/dashboard/AnalyticsNewDiscussionsChart";
import { AnalyticsDiscussionRow } from "@/app/actions/getDiscussionsMetrics";
import ProjectNotFoundDialog from "@/components/dashboard/project/projectNotfoundDialog";
import { getProjectById } from "@/app/actions/projects";

type PageProps = {
    params: Promise<{ projectId: string }>;
};

// 1. DYNAMISME DE L'ONGLET
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const resolvedParams = await params;
    const projectId = resolvedParams.projectId;
    const session = await getSession();

    if (!session?.user?.id) return { title: "Connexion requise | ExtravertyAI" };

    const projectMembership = await prisma.projectMembership.findUnique({
        where: {
            userId_projectId: {
                userId: session.user.id,
                projectId: projectId,
            },
        },
        select: { project: { select: { name: true } } },
    });

    if (!projectMembership) return { title: "Projet introuvable | ExtravertyAI" };

    return {
        title: `${projectMembership.project.name} - Analytics | ExtravertyAI`,
        description: `Gérez les analytics pour le projet ${projectMembership.project.name}`,
    };
}

export default async function AnalyticsPage({ params }: PageProps) {
    const resolvedParams = await params;
    const projectId = resolvedParams.projectId;

    const session = await getSession()
    if (!session?.user?.id) {
        return redirect(`/sign-in?callbackUrl=/projects/${projectId}/analytics`)
    }
    const project = await getProjectById(projectId);
    if (!project) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                {/* On affiche directement la modale par-dessus un fond vide */}
                <ProjectNotFoundDialog open={true} />
            </div>
        );
    }
    if (project.userRole !== "OWNER" && project.userRole !== "ADMIN") {
        return redirect(`/projects/${projectId}?error=unauthorized`);
    }
    const statsResult = await getMessageSourcesStats(projectId, "7d");
    // const { chartData, totalCount } = await getAnalyticsDiscussionsMetrics(projectId, "1y");
    return (
        <>
            <AnalyticsMessageRecuChart projectId={projectId} range="1y" />
            <CustomSourceMessageChart
                initialData={statsResult.data}
                initialTotal={statsResult.totalMessages}
                projectId={projectId}
                className="mt-6"
            />
            <AnalyticsDiscussionsChart
                data={mockAnalyticsData1Month}
                total={mockAnalyticsTotal}
                periodLabel="30 derniers jours"
            />
            {/* <AnalyticsDiscussionsChart
                data={chartData}
                total={totalCount}
                periodLabel={"1y"}
            /> */}
        </>
    )
}


export const mockAnalyticsData1Month: AnalyticsDiscussionRow[] = [
    { date: "2026-08-08", count: 42 }, { date: "2026-08-09", count: 38 },
    { date: "2026-08-10", count: 65 }, { date: "2026-08-11", count: 72 },
    { date: "2026-08-12", count: 80 }, { date: "2026-08-13", count: 76 },
    { date: "2026-08-14", count: 68 }, { date: "2026-08-15", count: 45 },
    { date: "2026-08-16", count: 40 }, { date: "2026-08-17", count: 75 },
    { date: "2026-08-18", count: 85 }, { date: "2026-08-19", count: 92 },
    { date: "2026-08-20", count: 88 }, { date: "2026-08-21", count: 70 },
    { date: "2026-08-22", count: 48 }, { date: "2026-08-23", count: 42 },
    { date: "2026-08-24", count: 82 }, { date: "2026-08-25", count: 95 },
    { date: "2026-08-26", count: 105 }, { date: "2026-08-27", count: 98 },
    { date: "2026-08-28", count: 85 }, { date: "2026-08-29", count: 55 },
    { date: "2026-08-30", count: 50 }, { date: "2026-08-31", count: 90 },
    { date: "2026-09-01", count: 110 }, { date: "2026-09-02", count: 125 },
    { date: "2026-09-03", count: 118 }, { date: "2026-09-04", count: 105 },
    { date: "2026-09-05", count: 65 }, { date: "2026-09-06", count: 58 },
];

export const mockAnalyticsTotal = mockAnalyticsData1Month.reduce((acc, curr) => acc + curr.count, 0); // ~2232

