import { headers } from "next/headers";
import ProjectsPageClient from "./ProjectsPageClient";
import type { Task } from "@/data/mockTasksData";
import type { TeamAgent } from "@/data/mockTeamData";
import { getAgentTasks } from "@/lib/agent-tasks-data";
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

async function getInitialTeam(): Promise<TeamAgent[]> {
  try {
    const requestHeaders = await headers();
    const host = requestHeaders.get("host");
    if (!host) return [];

    const protocol = requestHeaders.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
    const cookie = requestHeaders.get("cookie") || "";

    const response = await fetch(`${protocol}://${host}/api/team`, {
      headers: cookie ? { cookie } : undefined,
      cache: "no-store",
    });

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as { team?: TeamAgent[] };
    return Array.isArray(data.team) ? data.team : [];
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

  return (
    <ProjectsPageClient
      initialProjects={initialProjects}
      initialTeam={initialTeam}
      initialTasks={initialTasks}
      initialTasksAvailable={initialTasksAvailable}
    />
  );
}
