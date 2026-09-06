import { getProjectById } from "@/app/actions/projects";
import ProjectNotFoundDialog from "@/components/dashboard/project/projectNotfoundDialog";
import { redirect } from "next/navigation";

type PageProps = {
    params: Promise<{ projectId: string }>;
    children: React.ReactNode;
};

export default async function DashboardLayout({ params, children }: PageProps) {
    const resolvedParams = await params;
    const projectId = resolvedParams.projectId;

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
        <>
            {children}
        </>
    );
}