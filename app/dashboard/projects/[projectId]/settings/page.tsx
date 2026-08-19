import ProjectSettingsPage from "@/components/dashboard/project/projectSettingsPage";
import { getSession } from "@/lib/auth-server";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
    const session = await getSession();
    if (!session?.user?.id) {
        return redirect(`/sign-in?callbackUrl=/dashboard/projects`);
    }
    return (
        <ProjectSettingsPage />
    );
}
