import CreateProjectForm from '@/components/dashboard/project/createProjectForm'
import { getSession } from '@/lib/auth-server';
import type { Metadata } from "next";
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
    title: "New Project | ExtravertyAI",
}

async function NewProjectPage() {
    const session = await getSession();
    if (!session?.user?.id) {
        return redirect(`/sign-in?callbackUrl=/dashboard/projects/new`);
    }
    return (
        <CreateProjectForm />
    )
}

export default NewProjectPage