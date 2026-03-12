import TasksPageClient from "./TasksPageClient";
import { getAgentTasks } from "@/lib/agent-tasks-data";
import { getAgentsSummary } from "@/lib/agents-data";
import { getProjects } from "@/lib/projects-data";
import type { Project } from "@/data/mockProjectsData";

export const dynamic = "force-dynamic";

async function getInitialTasks() {
  try {
    return await getAgentTasks();
  } catch {
    return [];
  }
}

async function getTaskAgentOptions() {
  try {
    const agents = await getAgentsSummary();
    return agents
      .filter((agent) => agent.id !== "main")
      .map((agent) => ({
        id: agent.id,
        name: agent.name || agent.id,
        emoji: agent.emoji,
        color: agent.color,
      }));
  } catch {
    return [];
  }
}

async function getInitialProjects(): Promise<Project[]> {
  try {
    return await getProjects();
  } catch {
    return [];
  }
}

export default async function TasksPage() {
  const [initialTasks, initialTaskAgents, initialProjects] = await Promise.all([
    getInitialTasks(),
    getTaskAgentOptions(),
    getInitialProjects(),
  ]);

  return (
    <TasksPageClient
      initialTasks={initialTasks}
      initialTaskAgents={initialTaskAgents}
      initialProjects={initialProjects}
    />
  );
}
