import { getSession } from "@/lib/auth-server";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function ProjectPage({ params }: { params: { projectId: string } }) {
  const { projectId } = await params;
  const session = await getSession();
  if (!session?.user?.id) {
    // Si l'utilisateur n'est pas connecté, on le redirige vers la page de connexion
    return redirect("/sign-in");
  }
  // Sécurité Pro : Vérification de l'accès
  const membership = await prisma.projectMembership.findUnique({
    where: {
      userId_projectId: {
        userId: session.user.id,
        projectId: projectId,
      },
    },
  });

  if (!membership) {
    // Si l'utilisateur n'est pas lié à ce projet, on le dégage
    return redirect("/dashboard");
  }

  // Ici, le code continue car l'utilisateur a bien les droits
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    // Si le projet n'existe pas, on redirige vers la page des projets
    return redirect("/dashboard/projects");
  }
  return <div>Bienvenue sur {project.name}</div>;
}