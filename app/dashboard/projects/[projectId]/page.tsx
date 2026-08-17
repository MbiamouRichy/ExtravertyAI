import { getProjectById } from "@/app/actions/projects";
import { getSession } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import ProjectWorkspace from "@/components/dashboard/project/whatsappSendMessageForm";


// Typage Next.js 15 : params et searchParams sont des Promises
type PageProps = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

// 1. DYNAMISME DE L'ONGLET : Génération dynamique des Metadata
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  // 🚨 FIX : Il faut 'await params' avant de l'utiliser dans Next 15
  const resolvedParams = await params;
  const projectId = resolvedParams.projectId;

  const session = await getSession();

  if (!session?.user?.id) {
    return { title: "Connexion requise | ExtravertyAI" };
  }

  const projectMembership = await prisma.projectMembership.findUnique({
    where: {
      userId_projectId: {
        userId: session.user.id,
        projectId: projectId, // Utilisation de l'ID résolu
      },
    },
    select: { project: { select: { name: true } } },
  });

  if (!projectMembership) return { title: "Projet introuvable | ExtravertyAI" };

  return {
    title: `${projectMembership.project.name} | ExtravertyAI`,
    description: `Espace de travail pour le projet ${projectMembership.project.name}`,
  };
}

// 2. RENDU DE LA PAGE
export default async function ProjectPage({ params, searchParams }: PageProps) {

  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  const projectId = resolvedParams.projectId;
  const isSuccess = resolvedSearchParams.success === "true";

  const session = await getSession();
  if (!session?.user?.id) {
    return redirect(`/sign-in?callbackUrl=/dashboard/projects/${projectId}`);
  }

  const project = await getProjectById(projectId);

  if (!project) {
    return redirect("/dashboard/projects");
  }

  return (
    <ProjectWorkspace project={project} user={session.user} isSuccess={isSuccess} />
  );
}