import { getProjectById } from "@/app/actions/projects";
import { getSession } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import ProjectWorkspace from "@/components/dashboard/project/whatsappSendMessageForm";
import QRCodeScanner from "@/components/dashboard/project/qrCodeScanner";

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
  if (!project) return redirect("/dashboard/projects");

  // FAILLE CORRIGÉE : La condition logique est maintenant stricte et correcte
  if (project.instanceStatus === "qr_ready" || project.instanceStatus === "connecting") {
    return <QRCodeScanner projectId={projectId} />;
  }

  if (project.instanceStatus === "connected") {
    return <ProjectWorkspace project={project} user={session.user} isSuccess={isSuccess} />;
  }

  // FAILLE CORRIGÉE : Ajout d'un Fallback visuel pour les autres statuts (ex: "disconnected", "initializing")
  return (
    <div className="flex h-[80vh] w-full items-center justify-center">
      <div className="flex flex-col items-center space-y-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600"></div>
        <p className="text-sm font-medium text-gray-500">Initialisation de l&apos;instance WhatsApp...</p>
      </div>
    </div>
  );
}