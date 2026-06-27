import { getProjects } from "@/app/actions/projects"

export default async function ProjectsPage() {

  return (
    <ProjectsPage projects={await getProjects()} />
  )
}