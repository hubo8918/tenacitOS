"use client";

import { FolderKanban } from "lucide-react";
import { ProjectCard } from "@/components/ProjectCard";
import type { Project } from "@/data/mockProjectsData";
import type { Task } from "@/data/mockTasksData";
import type { TeamAgent } from "@/data/mockTeamData";
import { useFetch } from "@/lib/useFetch";

interface ProjectsPageClientProps {
  initialProjects: Project[];
  initialTeam: TeamAgent[];
  initialTasks: Task[];
  initialTasksAvailable: boolean;
}

function normalizeProjectLabel(value: string) {
  return value.trim().toLowerCase();
}

export default function ProjectsPageClient({
  initialProjects,
  initialTeam,
  initialTasks,
  initialTasksAvailable,
}: ProjectsPageClientProps) {
  const hasInitialProjects = initialProjects.length > 0;
  const { data, loading, error, refetch } = useFetch<{ projects: Project[] }>("/api/projects", {
    initialData: hasInitialProjects ? { projects: initialProjects } : null,
    fetchOnMount: !hasInitialProjects,
  });
  const {
    data: tasksData,
    loading: tasksLoading,
    error: tasksError,
  } = useFetch<{ tasks: Task[] }>("/api/agent-tasks", {
    initialData: initialTasksAvailable ? { tasks: initialTasks } : null,
    fetchOnMount: !initialTasksAvailable,
  });
  const projects = data?.projects || [];
  const tasks = tasksData?.tasks || [];
  const linkedTasksLoading = tasksLoading && !tasksData && !tasksError;
  const linkedTasksUnavailable = Boolean(tasksError) && !tasksData && !tasksLoading;

  const activeCount = projects.filter((p) => p.status === "active").length;
  const planningCount = projects.filter((p) => p.status === "planning").length;

  if (loading && !data) {
    return (
      <div className="p-4 md:p-8 flex items-center justify-center min-h-[50vh]">
        <p style={{ color: "var(--text-secondary)" }}>Loading projects...</p>
      </div>
    );
  }

  if (error && projects.length === 0) {
    return (
      <div className="p-4 md:p-8 flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <p style={{ color: "var(--text-error, #ef4444)" }}>Failed to load projects: {error}</p>
        <button
          onClick={refetch}
          className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
          style={{
            backgroundColor: "var(--surface-elevated)",
            color: "var(--text-primary)",
            border: "1px solid var(--border)",
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1
          className="text-3xl font-bold mb-2"
          style={{
            fontFamily: "var(--font-heading)",
            color: "var(--text-primary)",
            letterSpacing: "-1.5px",
          }}
        >
          <FolderKanban className="inline-block w-8 h-8 mr-2 mb-1" />
          Projects
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
          {projects.length} total &bull; {activeCount} active &bull; {planningCount} planning
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {projects.map((project) => {
          const linkedTasks = tasks.filter(
            (task) => normalizeProjectLabel(task.project) === normalizeProjectLabel(project.title)
          );

          return (
            <ProjectCard
              key={project.id}
              project={project}
              teamAgents={initialTeam}
              linkedTasks={linkedTasks}
              linkedTasksLoading={linkedTasksLoading}
              linkedTasksUnavailable={linkedTasksUnavailable}
              onUpdate={refetch}
            />
          );
        })}
      </div>
    </div>
  );
}
