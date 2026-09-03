import ProjectSettingsPage from "@/components/dashboard/project/projectSettingsPage";
import { getSession } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import { getProjectById } from "@/app/actions/projects";
import ProjectNotFoundDialog from "@/components/dashboard/project/projectNotfoundDialog";
export const dynamic = "force-dynamic";

type SettingPageProps = {
    params: Promise<{ projectId: string }>;
};

// 1. DYNAMISME DE L'ONGLET
export async function generateMetadata({ params }: SettingPageProps): Promise<Metadata> {
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


export default async function SettingsPage({ params }: SettingPageProps) {
    const resolvedParams = await params;
    const projectId = resolvedParams.projectId;
    const session = await getSession();
    if (!session?.user?.id) {
        return redirect(`/sign-in?callbackUrl=/projects/${projectId}/settings`);
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

    return (
        <ProjectSettingsPage project={project} />
    );
}
