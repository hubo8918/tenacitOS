"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { FolderKanban, Plus } from "lucide-react";
import { ProjectCard } from "@/components/ProjectCard";
import { priorityConfig, statusConfig, type Project } from "@/data/mockProjectsData";
import type { Task } from "@/data/mockTasksData";
import type { TeamAgent } from "@/data/mockTeamData";
import { normalizeProjectLabel, resolveProjectForTask, taskHasProjectMismatch, taskLinksToProject } from "@/lib/project-task-linkage";
import { useFetch } from "@/lib/useFetch";

interface ProjectsPageClientProps {
  initialProjects: Project[];
  initialTeam: TeamAgent[];
  initialTasks: Task[];
  initialTasksAvailable: boolean;
}

export default function ProjectsPageClient({
  initialProjects,
  initialTeam,
  initialTasks,
  initialTasksAvailable,
}: ProjectsPageClientProps) {
  const searchParams = useSearchParams();
  const projectFocus = searchParams.get("project")?.trim() || "";
  const projectIdFocus = searchParams.get("projectId")?.trim() || "";
  const requestedTaskId = searchParams.get("task")?.trim() || "";
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
    refetch: refetchTasks,
  } = useFetch<{ tasks: Task[] }>("/api/agent-tasks", {
    initialData: initialTasksAvailable ? { tasks: initialTasks } : null,
    fetchOnMount: !initialTasksAvailable,
  });
  const projects = data?.projects || [];
  const tasks = tasksData?.tasks || [];
  const linkedTasksLoading = tasksLoading && !tasksData && !tasksError;
  const linkedTasksUnavailable = Boolean(tasksError) && !tasksData && !tasksLoading;
  const focusedProject = projectIdFocus ? projects.find((project) => project.id === projectIdFocus) || null : null;
  const effectiveProjectFocus = focusedProject?.title || projectFocus;
  const requestedTask = requestedTaskId ? tasks.find((task) => task.id === requestedTaskId) || null : null;
  const requestedTaskStillMatchesFocus = Boolean(
    requestedTask && (focusedProject ? taskLinksToProject(requestedTask, focusedProject) : effectiveProjectFocus && normalizeProjectLabel(requestedTask.project) === normalizedProjectFocus)
  );
  const requestedTaskCurrentProject = requestedTask ? resolveProjectForTask(requestedTask, projects) : null;
  const requestedTaskTasksHref = requestedTask
    ? requestedTaskStillMatchesFocus
      ? `/agents/tasks?mismatch=1&task=${encodeURIComponent(requestedTask.id)}`
      : requestedTaskCurrentProject
        ? `/agents/tasks?project=${encodeURIComponent(requestedTaskCurrentProject.title)}&projectId=${encodeURIComponent(requestedTaskCurrentProject.id)}&task=${encodeURIComponent(requestedTask.id)}`
        : requestedTask.project.trim()
          ? `/agents/tasks?project=${encodeURIComponent(requestedTask.project.trim())}&task=${encodeURIComponent(requestedTask.id)}`
          : `/agents/tasks?task=${encodeURIComponent(requestedTask.id)}`
    : "/agents/tasks";
  const visibleProjects = focusedProject
    ? [focusedProject]
    : normalizedProjectFocus
      ? projects.filter((project) => normalizeProjectLabel(project.title) === normalizedProjectFocus)
      : projects;
  const taskProjectLabelMismatchTasks = tasks.filter((task) => taskHasProjectMismatch(task, projects));
  const taskProjectLabelMismatchPreview = (() => {
    if (taskProjectLabelMismatchTasks.length === 0) {
      return "";
    }

    const labelCounts = new Map<string, number>();
    taskProjectLabelMismatchTasks.forEach((task) => {
      const trimmedProject = task.project.trim();
      labelCounts.set(trimmedProject, (labelCounts.get(trimmedProject) || 0) + 1);
    });

    const topLabels = Array.from(labelCounts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 2)
      .map(([label]) => label);
    const remainingLabelCount = labelCounts.size - topLabels.length;

    return `${topLabels.join(", ")}${remainingLabelCount > 0 ? ` +${remainingLabelCount} more` : ""}`;
  })();
  const firstMismatchTaskId = taskProjectLabelMismatchTasks[0]?.id || "";
  const mismatchTasksHref = firstMismatchTaskId
    ? `/agents/tasks?mismatch=1&task=${encodeURIComponent(firstMismatchTaskId)}`
    : "/agents/tasks?mismatch=1";
  const showTaskProjectMismatchSummary = !effectiveProjectFocus && !linkedTasksLoading && !linkedTasksUnavailable && taskProjectLabelMismatchTasks.length > 0;

  const activeCount = visibleProjects.filter((p) => p.status === "active").length;
  const planningCount = visibleProjects.filter((p) => p.status === "planning").length;

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newStatus, setNewStatus] = useState<Project["status"]>("planning");
  const [newPriority, setNewPriority] = useState<Project["priority"]>("medium");
  const [newOwnerAgentId, setNewOwnerAgentId] = useState("");

  const resetCreateForm = () => {
    setNewTitle("");
    setNewDescription("");
    setNewStatus("planning");
    setNewPriority("medium");
    setNewOwnerAgentId("");
    setCreateError(null);
  };

  const handleToggleCreateForm = () => {
    if (showCreateForm) {
      resetCreateForm();
      setShowCreateForm(false);
      return;
    }

    setCreateError(null);
    setShowCreateForm(true);
  };

  const handleCreateProject = async () => {
    const trimmedTitle = newTitle.trim();
    const trimmedDescription = newDescription.trim();

    if (!trimmedTitle) {
      setCreateError("Title is required.");
      return;
    }

    if (!trimmedDescription) {
      setCreateError("Description is required.");
      return;
    }

    setCreatingProject(true);
    setCreateError(null);

    try {
      const owner = initialTeam.find((agent) => agent.id === newOwnerAgentId);
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmedTitle,
          description: trimmedDescription,
          status: newStatus,
          priority: newPriority,
          ownerAgentId: owner?.id || undefined,
          agent: owner
            ? { emoji: owner.emoji, name: owner.name, color: owner.color }
            : { emoji: "👤", name: "Unassigned", color: "#8E8E93" },
          updatedAgo: "just now",
          updatedBy: "Mission Control",
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to create project");
      }

      resetCreateForm();
      setShowCreateForm(false);
      refetch();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setCreatingProject(false);
    }
  };

  const formInputStyle = {
    width: "100%",
    padding: "0.7rem 0.8rem",
    borderRadius: "0.75rem",
    border: "1px solid var(--border)",
    backgroundColor: "var(--card)",
    color: "var(--text-primary)",
    fontSize: "0.9rem",
    outline: "none",
  };

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
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
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
            {visibleProjects.length} {effectiveProjectFocus ? "in focus" : "total"} &bull; {activeCount} active &bull; {planningCount} planning
          </p>
        </div>

        <button
          onClick={handleToggleCreateForm}
          className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors"
          style={{
            backgroundColor: showCreateForm ? "var(--surface-elevated)" : "var(--accent)",
            color: showCreateForm ? "var(--text-primary)" : "#000",
            border: showCreateForm ? "1px solid var(--border)" : "none",
          }}
        >
          <Plus className="w-4 h-4" />
          {showCreateForm ? "Close project intake" : "New project"}
        </button>
      </div>

      {showCreateForm && (
        <div
          className="mb-6 rounded-2xl p-4 md:p-5"
          style={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Create a tracked project
              </p>
              <p className="mt-1 text-sm" style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
                This first Projects CRUD intake stays narrow and honest: title, description, board status, priority, and initial owner save here. Participating agents, current phase, and linked tasks still deepen through later steps instead of pretending this is the whole project-management surface.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <label className="flex flex-col gap-1.5 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                Title
                <input
                  value={newTitle}
                  onChange={(event) => setNewTitle(event.target.value)}
                  placeholder="Mission-critical rollout"
                  style={formInputStyle}
                />
              </label>

              <label className="flex flex-col gap-1.5 text-xs font-semibold xl:col-span-2" style={{ color: "var(--text-secondary)" }}>
                Description
                <input
                  value={newDescription}
                  onChange={(event) => setNewDescription(event.target.value)}
                  placeholder="What this project is for"
                  style={formInputStyle}
                />
              </label>

              <label className="flex flex-col gap-1.5 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                Initial status
                <select value={newStatus} onChange={(event) => setNewStatus(event.target.value as Project["status"])} style={formInputStyle}>
                  {Object.entries(statusConfig).map(([value, config]) => (
                    <option key={value} value={value}>
                      {config.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                Priority
                <select value={newPriority} onChange={(event) => setNewPriority(event.target.value as Project["priority"])} style={formInputStyle}>
                  {Object.entries(priorityConfig).map(([value, config]) => (
                    <option key={value} value={value}>
                      {config.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                Initial owner
                <select value={newOwnerAgentId} onChange={(event) => setNewOwnerAgentId(event.target.value)} style={formInputStyle}>
                  <option value="">Unassigned</option>
                  {initialTeam.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.emoji} {agent.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {createError && (
              <p className="text-sm font-medium" style={{ color: "var(--status-blocked)" }}>
                {createError}
              </p>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              <button
                onClick={() => {
                  resetCreateForm();
                  setShowCreateForm(false);
                }}
                className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
                style={{
                  backgroundColor: "transparent",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border)",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateProject}
                disabled={creatingProject}
                className="px-4 py-2 text-sm font-semibold rounded-lg transition-colors"
                style={{
                  backgroundColor: "var(--accent)",
                  color: "#000",
                  opacity: creatingProject ? 0.7 : 1,
                }}
              >
                {creatingProject ? "Creating..." : "Create project"}
              </button>
            </div>
          </div>
        </div>
      )}

      {effectiveProjectFocus && (
        <div
          className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg px-3 py-2 text-xs"
          style={{
            backgroundColor: "var(--surface-elevated)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="space-y-1">
            <p className="font-semibold" style={{ color: "var(--text-primary)" }}>
              Project focus: {effectiveProjectFocus}
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

      {showTaskProjectMismatchSummary && (
        <div
          className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg px-3 py-2 text-xs"
          style={{
            backgroundColor: "var(--surface-elevated)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="space-y-1">
            <p className="font-semibold" style={{ color: "#FFD60A" }}>
              Task ↔ Project linkage cleanup needed
            </p>
            <p style={{ color: "var(--text-muted)", lineHeight: 1.4 }}>
              {taskProjectLabelMismatchTasks.length} task project link mismatch{taskProjectLabelMismatchTasks.length === 1 ? "" : "es"} currently do not resolve to a live Projects record ({taskProjectLabelMismatchPreview}). Projects stays read-only here instead of pretending those tasks are linked, so this handoff lands on the first affected Tasks row for cleanup.
            </p>
          </div>
          <a
            href={mismatchTasksHref}
            className="rounded-full px-3 py-1 font-medium"
            style={{
              color: "#FFD60A",
              border: "1px solid color-mix(in srgb, #FFD60A 32%, transparent)",
            }}
          >
            Open first mismatched task in Tasks
          </a>
        </div>
      )}

      {effectiveProjectFocus && visibleProjects.length === 0 ? (
        <div
          className="rounded-2xl p-6 text-center"
          style={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="mx-auto max-w-lg space-y-3">
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              No live project for {effectiveProjectFocus} is tracked right now
            </p>
            <p className="text-sm" style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
              This focus came from a task handoff. Projects stays honest here: if no current project record resolves that focus, it shows the mismatch instead of pretending it found the right card.
            </p>
            {requestedTask && (
              <p className="text-sm" style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
                The requested task <span style={{ color: "var(--text-primary)" }}>{requestedTask.title}</span> still owns that saved label, so cleanup stays on Tasks through the existing row-level project-field editor instead of pretending Projects can repair linkage inline.
              </p>
            )}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <a
                href={requestedTaskTasksHref}
                className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
                style={{
                  backgroundColor: requestedTask ? "transparent" : "var(--surface-elevated)",
                  color: requestedTask ? "#FF9F0A" : "var(--text-primary)",
                  border: requestedTask ? "1px solid color-mix(in srgb, #FF9F0A 28%, transparent)" : "1px solid var(--border)",
                }}
              >
                {requestedTaskStillMatchesFocus
                  ? "Open requested task in Tasks cleanup view"
                  : requestedTask
                    ? "Open requested task in Tasks"
                    : "Open full Tasks board"}
              </a>
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
          const linkedTasks = tasks.filter((task) => taskLinksToProject(task, project));

          return (
            <ProjectCard
              key={project.id}
              project={project}
              teamAgents={initialTeam}
              linkedTasks={linkedTasks}
              linkedTasksLoading={linkedTasksLoading}
              linkedTasksUnavailable={linkedTasksUnavailable}
              onUpdate={() => {
                refetch();
                refetchTasks();
              }}
            />
          );
        })}
      </div>
      )}
    </div>
  );
}
