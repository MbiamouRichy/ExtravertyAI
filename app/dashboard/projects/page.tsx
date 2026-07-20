import { getProjects } from "@/app/actions/projects"
import HomeProjectsPage from "@/components/dashboard/project/homePage"
import { getSession } from "@/lib/auth-server";
import { redirect } from "next/navigation";

export default async function ProjectsPage() {
  const session = await getSession();
  if (!session?.user) {
    // Si l'utilisateur n'est pas connecté, on le redirige vers la page de connexion
    return redirect("/sign-in");
  }
  const projects = await getProjects();
  return (
    <HomeProjectsPage projects={projects} />
  )
}

