"use client";

import { useSearchParams } from "next/navigation";
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
  const searchParams = useSearchParams();
  const projectFocus = searchParams.get("project")?.trim() || "";
  const normalizedProjectFocus = normalizeProjectLabel(projectFocus);
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
  const visibleProjects = normalizedProjectFocus
    ? projects.filter((project) => normalizeProjectLabel(project.title) === normalizedProjectFocus)
    : projects;

  const activeCount = visibleProjects.filter((p) => p.status === "active").length;
  const planningCount = visibleProjects.filter((p) => p.status === "planning").length;

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
          {visibleProjects.length} {projectFocus ? "in focus" : "total"} &bull; {activeCount} active &bull; {planningCount} planning
        </p>
      </div>

      {projectFocus && (
        <div
          className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg px-3 py-2 text-xs"
          style={{
            backgroundColor: "var(--surface-elevated)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="space-y-1">
            <p className="font-semibold" style={{ color: "var(--text-primary)" }}>
              Project focus: {projectFocus}
            </p>
            <p style={{ color: "var(--text-muted)", lineHeight: 1.4 }}>
              Opened from Tasks. Showing {visibleProjects.length} matching project{visibleProjects.length === 1 ? "" : "s"} with this exact title.
            </p>
          </div>
          <a
            href="/agents/projects"
            className="rounded-full px-3 py-1 font-medium"
            style={{
              color: "#0A84FF",
              border: "1px solid color-mix(in srgb, #0A84FF 28%, transparent)",
            }}
          >
            Clear focus
          </a>
        </div>
      )}

      {projectFocus && visibleProjects.length === 0 ? (
        <div
          className="rounded-2xl p-6 text-center"
          style={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="mx-auto max-w-lg space-y-3">
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              No project titled {projectFocus} is tracked right now
            </p>
            <p className="text-sm" style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
              This focus came from a task&apos;s saved project label. Projects stays honest here: if no current project title matches that label exactly, it shows the mismatch instead of pretending it found the right card.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <a
                href="/agents/projects"
                className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
                style={{
                  backgroundColor: "var(--surface-elevated)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border)",
                }}
              >
                View full Projects board
              </a>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {visibleProjects.map((project) => {
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
      )}
    </div>
  );
}
