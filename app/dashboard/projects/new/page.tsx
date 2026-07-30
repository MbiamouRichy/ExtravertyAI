import CreateProjectForm from '@/components/dashboard/project/createInstanceForm'
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "New Project | ExtravertyAI",
}

function NewProjectPage() {
    return (
        <CreateProjectForm />
    )
}

export default NewProjectPage