import { getProjectById } from "@/app/actions/projects";
import { getSession } from "@/lib/auth-server";
import { redirect } from "next/navigation";

// Typage avec des Promises pour Next.js 15/16
type PageProps = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
};

export default async function ProjectPage({ params, searchParams }: PageProps) {
  const { projectId } = await params;
  const { success } = await searchParams;
  const isSuccess = success === "true";

  const session = await getSession();
  if (!session?.user?.id) {
    return redirect(`/sign-in?callbackUrl=/dashboard/projects/${projectId}`);
  }

  const project = await getProjectById(projectId);
  console.log("project ID:", projectId, "project:", project);

  if (!project) {
    return redirect("/dashboard/projects");
  }

  return (
    <div>
      {isSuccess && (
        <div className="bg-green-100 text-green-800 p-2 rounded mb-4">
          L&apos;action a été réalisée avec succès !
        </div>
      )}

      Bienvenue sur {project.name}
    </div>
  );
}