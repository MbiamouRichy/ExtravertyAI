import { getSession } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Dashboard } from "@/components/dashboard/dashboard";
import { getProjectById } from "@/app/actions/projects";
import prisma from "@/lib/prisma";
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
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
    title: `${projectMembership.project.name} | Dashboard | ExtravertyAI`,
    description: `Tableau de board pour le projet ${projectMembership.project.name}`,
  };
}

export default async function ProjectDashboardPage({ params }: PageProps) {
  const resolvedParams = await params;

  const projectId = resolvedParams.projectId;

  const session = await getSession();
  if (!session?.user?.id) {
    return redirect(`/sign-in?callbackUrl=/projects/${projectId}`);
  }

  const project = await getProjectById(projectId);
  if (!project) return redirect("/projects");
  return (
    <Dashboard />
  );
}
