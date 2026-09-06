import { getSession } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import { Metadata } from "next";
import prisma from "@/lib/prisma";
import { AnalyticsMessageRecuChart } from "@/components/dashboard/analytics-message-recu";

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
        title: `${projectMembership.project.name} - Contacts | ExtravertyAI`,
        description: `Gérez les contacts pour le projet ${projectMembership.project.name}`,
    };
}

export default async function AnalyticsPage({ params }: PageProps) {
    const resolvedParams = await params;
    const projectId = resolvedParams.projectId;

    const session = await getSession()
    if (!session?.user?.id) {
        return redirect(`/sign-in?callbackUrl=/projects/${projectId}/analytics`)
    }
    return (
        <AnalyticsMessageRecuChart projectId={projectId} range="30d" />
    )
}

