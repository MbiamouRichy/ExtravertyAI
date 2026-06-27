import { getProjects } from "@/app/actions/projects"
import HomeProjectsPage from "@/components/project/homePage"

export default async function ProjectsPage() {

  return (
    <HomeProjectsPage projects={await getProjects()} />
  )
}