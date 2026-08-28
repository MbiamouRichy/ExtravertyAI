import ProjectSettingsPage from "@/components/dashboard/project/projectSettingsPage";
import { getSession } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import { getProjectById } from "@/app/actions/projects";
export const dynamic = "force-dynamic";

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
        title: `${projectMembership.project.name} | Settings | ExtravertyAI`,
        description: `Espace de paramètres pour le projet ${projectMembership.project.name}`,
    };
}


export default async function SettingsPage({ params }: PageProps) {
    const resolvedParams = await params;
    const projectId = resolvedParams.projectId;
    const session = await getSession();
    if (!session?.user?.id) {
        return redirect(`/sign-in?callbackUrl=/dashboard/projects/${projectId}/settings`);
    }

    const project = await getProjectById(projectId);
    if (!project) return redirect("/dashboard/projects");

    return (
        <ProjectSettingsPage project={project} />
    );
}
