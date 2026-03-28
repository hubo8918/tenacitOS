import ProjectsPageClient from "./ProjectsPageClient";
import type { ReviewDecisionAgentOption } from "@/components/ReviewDecisionComposer";
import type { Task } from "@/data/mockTasksData";
import { getAgentTasks } from "@/lib/agent-tasks-data";
import { getAgentsSummary } from "@/lib/agents-data";
import { applyDerivedProjectProgress } from "@/lib/project-progress";
import { getProjects } from "@/lib/projects-data";

export const dynamic = "force-dynamic";

async function getInitialProjects() {
  try {
    return await getProjects();
  } catch {
    return [];
  }
}

async function getInitialTasks(): Promise<{ tasks: Task[]; available: boolean }> {
  try {
    const tasks = await getAgentTasks();
    return { tasks, available: true };
  } catch {
    return { tasks: [], available: false };
  }
}

async function getInitialTeam(): Promise<ReviewDecisionAgentOption[]> {
  try {
    const agents = await getAgentsSummary();
    return agents
      .filter((agent) => agent.id !== "main")
      .map((agent) => ({
        id: agent.id,
        name: agent.name || agent.id,
      }));
  } catch {
    return [];
  }
}

export default async function ProjectsPage() {
  const [{ tasks: initialTasks, available: initialTasksAvailable }, initialProjects, initialTeam] = await Promise.all([
    getInitialTasks(),
    getInitialProjects(),
    getInitialTeam(),
  ]);
  const hydratedProjects = applyDerivedProjectProgress(initialProjects, initialTasks);

  return (
    <ProjectsPageClient
      initialProjects={hydratedProjects}
      initialTeam={initialTeam}
      initialTasks={initialTasks}
      initialTasksAvailable={initialTasksAvailable}
    />
  );
}
