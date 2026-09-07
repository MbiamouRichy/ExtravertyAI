import { getProjectById } from "@/app/actions/projects";
import { getTeamMembers } from "@/app/actions/team";
import ProjectNotFoundDialog from "@/components/dashboard/project/projectNotfoundDialog";
import TeamManagement from "@/components/dashboard/project/team-management";
import { getSession } from "@/lib/auth-server";
import prisma from "@/lib/prisma";
import { Metadata } from "next";
import { redirect } from "next/navigation";

type PageProps = {
    params: Promise<{ projectId: string }>;
};

export const dynamic = "force-dynamic";
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
        title: `${projectMembership.project.name} - Team | ExtravertyAI`,
        description: `Gérez l'équipe pour le projet ${projectMembership.project.name}`,
    };
}


export default async function TeamPage({ params }: PageProps) {
    const resolvedParams = await params;
    const projectId = resolvedParams.projectId;
    const session = await getSession();

    if (!session?.user?.id) {
        return redirect(`/sign-in?callbackUrl=/projects/${projectId}/team`);
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
    const data = await getTeamMembers(projectId);


    return (
        <TeamManagement projectId={projectId} data={data} currentUserId={session.user.id} />
    );
}