import ProjectsPageClient from "./ProjectsPageClient";
import { getProjects } from "@/lib/projects-data";

export const dynamic = "force-dynamic";

async function getInitialProjects() {
  try {
    return await getProjects();
  } catch {
    return [];
  }
}

export default async function ProjectsPage() {
  const initialProjects = await getInitialProjects();
  return <ProjectsPageClient initialProjects={initialProjects} />;
}
