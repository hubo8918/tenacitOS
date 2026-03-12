"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ListTodo, ArrowUpDown, Plus } from "lucide-react";
import { TaskRow } from "@/components/TaskRow";
import { taskPriorityConfig, taskStatusConfig } from "@/data/mockTasksData";
import type { Task } from "@/data/mockTasksData";
import type { Project } from "@/data/mockProjectsData";
import { useFetch } from "@/lib/useFetch";

type StatusFilter = "all" | "in_progress" | "completed" | "pending" | "blocked";
type SortField = "title" | "status" | "priority" | "dueDate";
type SortDir = "asc" | "desc";

const priorityOrder = { high: 0, medium: 1, low: 2 };
const statusOrder = { blocked: 0, in_progress: 1, pending: 2, completed: 3 };
const unassignedAgent = {
  id: "",
  name: "Unassigned",
  emoji: "👤",
  color: "#8E8E93",
};

function parseLocalDate(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function isTaskOverdue(task: Task) {
  if (task.status === "completed") return false;
  const dueDate = parseLocalDate(task.dueDate);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return dueDate < startOfToday;
}

function getLocalDateInputValue(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeProjectLabel(value: string) {
  return value.trim().toLowerCase();
}

interface TaskAgentOption {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

interface TasksPageClientProps {
  initialTasks: Task[];
  initialTaskAgents: TaskAgentOption[];
  initialProjects: Project[];
}

export default function TasksPageClient({
  initialTasks,
  initialTaskAgents,
  initialProjects,
}: TasksPageClientProps) {
  const searchParams = useSearchParams();
  const projectFocus = searchParams.get("project")?.trim() || "";
  const normalizedProjectFocus = normalizeProjectLabel(projectFocus);
  const hasInitialTasks = initialTasks.length > 0;
  const { data, loading, error, refetch } = useFetch<{ tasks: Task[] }>("/api/agent-tasks", {
    initialData: hasInitialTasks ? { tasks: initialTasks } : null,
    fetchOnMount: !hasInitialTasks,
  });
  const hasInitialProjects = initialProjects.length > 0;
  const { data: projectsData } = useFetch<{ projects: Project[] }>("/api/projects", {
    initialData: hasInitialProjects ? { projects: initialProjects } : null,
    fetchOnMount: !hasInitialProjects,
  });
  const tasks = useMemo(() => data?.tasks || [], [data]);
  const normalizedProjectTitles = useMemo(
    () => new Set((projectsData?.projects || []).map((project) => normalizeProjectLabel(project.title))),
    [projectsData]
  );
  const canCheckProjectMatches = Boolean(projectsData);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showMismatchOnly, setShowMismatchOnly] = useState(false);
  const [sortField, setSortField] = useState<SortField>("status");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newProject, setNewProject] = useState(projectFocus);
  const [newDueDate, setNewDueDate] = useState(() => getLocalDateInputValue(7));
  const [newStatus, setNewStatus] = useState<Task["status"]>("pending");
  const [newPriority, setNewPriority] = useState<Task["priority"]>("medium");
  const [newAssigneeAgentId, setNewAssigneeAgentId] = useState("");

  const scopedTasks = useMemo(
    () =>
      normalizedProjectFocus
        ? tasks.filter((task) => normalizeProjectLabel(task.project) === normalizedProjectFocus)
        : tasks,
    [tasks, normalizedProjectFocus]
  );
  const projectLabelMismatchTasks = useMemo(() => {
    if (!canCheckProjectMatches) {
      return [];
    }

    return scopedTasks.filter((task) => {
      const trimmedProject = task.project.trim();
      return Boolean(trimmedProject) && !normalizedProjectTitles.has(normalizeProjectLabel(trimmedProject));
    });
  }, [canCheckProjectMatches, normalizedProjectTitles, scopedTasks]);
  const projectLabelMismatchCount = projectLabelMismatchTasks.length;
  const projectLabelMismatchTaskIds = useMemo(
    () => new Set(projectLabelMismatchTasks.map((task) => task.id)),
    [projectLabelMismatchTasks]
  );
  const projectLabelMismatchPreview = useMemo(() => {
    if (projectLabelMismatchTasks.length === 0) {
      return "";
    }

    const labelCounts = new Map<string, number>();
    projectLabelMismatchTasks.forEach((task) => {
      const trimmedProject = task.project.trim();
      labelCounts.set(trimmedProject, (labelCounts.get(trimmedProject) || 0) + 1);
    });

    const topLabels = Array.from(labelCounts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 2)
      .map(([label]) => label);
    const remainingLabelCount = labelCounts.size - topLabels.length;

    return `No exact Projects title match for ${topLabels.join(", ")}${remainingLabelCount > 0 ? ` +${remainingLabelCount} more` : ""}.`;
  }, [projectLabelMismatchTasks]);

  const focusedProjectTaskCount = scopedTasks.length;

  const filteredTasks = useMemo(() => {
    const filtered = (statusFilter === "all" ? [...scopedTasks] : scopedTasks.filter((task) => task.status === statusFilter)).filter(
      (task) => !showMismatchOnly || projectLabelMismatchTaskIds.has(task.id)
    );

    filtered.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "title":
          cmp = a.title.localeCompare(b.title);
          break;
        case "status": {
          cmp = statusOrder[a.status] - statusOrder[b.status];
          if (cmp === 0) {
            cmp = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
          }
          break;
        }
        case "priority":
          cmp = priorityOrder[a.priority] - priorityOrder[b.priority];
          break;
        case "dueDate":
          cmp = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return filtered;
  }, [projectLabelMismatchTaskIds, scopedTasks, showMismatchOnly, sortDir, sortField, statusFilter]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((direction) => (direction === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const handleToggleMismatchOnly = () => {
    setShowMismatchOnly((current) => {
      const next = !current;
      if (next) {
        setStatusFilter("all");
      }
      return next;
    });
  };

  useEffect(() => {
    setShowMismatchOnly(false);
  }, [normalizedProjectFocus]);

  useEffect(() => {
    if (showMismatchOnly && projectLabelMismatchCount === 0) {
      setShowMismatchOnly(false);
    }
  }, [projectLabelMismatchCount, showMismatchOnly]);

  useEffect(() => {
    if (!showCreateForm) {
      setNewProject(projectFocus);
    }
  }, [projectFocus, showCreateForm]);

  const resetCreateForm = () => {
    setNewTitle("");
    setNewProject(projectFocus);
    setNewDueDate(getLocalDateInputValue(7));
    setNewStatus("pending");
    setNewPriority("medium");
    setNewAssigneeAgentId("");
    setCreateError(null);
  };

  const handleToggleCreateForm = () => {
    if (showCreateForm) {
      resetCreateForm();
      setShowCreateForm(false);
      return;
    }

    setCreateError(null);
    setNewProject(projectFocus);
    setShowCreateForm(true);
  };

  const handleCreateTask = async () => {
    const trimmedTitle = newTitle.trim();
    const trimmedProject = newProject.trim();

    if (!trimmedTitle) {
      setCreateError("Title is required.");
      return;
    }

    if (!newDueDate) {
      setCreateError("Due date is required.");
      return;
    }

    setCreatingTask(true);
    setCreateError(null);

    try {
      const owner = initialTaskAgents.find((agent) => agent.id === newAssigneeAgentId);
      const response = await fetch("/api/agent-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmedTitle,
          project: trimmedProject,
          dueDate: newDueDate,
          status: newStatus,
          priority: newPriority,
          assigneeAgentId: owner?.id || undefined,
          agent: owner
            ? {
                id: owner.id,
                emoji: owner.emoji,
                name: owner.name,
                color: owner.color,
              }
            : {
                emoji: unassignedAgent.emoji,
                name: unassignedAgent.name,
                color: unassignedAgent.color,
              },
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to create task");
      }

      resetCreateForm();
      setShowCreateForm(false);
      refetch();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setCreatingTask(false);
    }
  };

  const inProgressCount = scopedTasks.filter((task) => task.status === "in_progress").length;
  const completedCount = scopedTasks.filter((task) => task.status === "completed").length;
  const blockedCount = scopedTasks.filter((task) => task.status === "blocked").length;
  const overdueCount = scopedTasks.filter(isTaskOverdue).length;

  const filterButtons: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "in_progress", label: "In Progress" },
    { key: "completed", label: "Completed" },
    { key: "pending", label: "Pending" },
    { key: "blocked", label: "Blocked" },
  ];
  const activeFilterLabel = filterButtons.find((button) => button.key === statusFilter)?.label ?? "Current";
  const hasAnyTasks = tasks.length > 0;
  const hasFocusedTasks = focusedProjectTaskCount > 0;

  const columns: { key: SortField | null; label: string; flex: string }[] = [
    { key: "title", label: "Task", flex: "flex-[3]" },
    { key: "status", label: "Status", flex: "flex-[1.2]" },
    { key: "priority", label: "Priority", flex: "flex-[1]" },
    { key: null, label: "Owner", flex: "flex-[1.2]" },
    { key: null, label: "Project", flex: "flex-[1.5]" },
    { key: "dueDate", label: "Due", flex: "flex-[1]" },
    { key: null, label: "", flex: "w-8" },
  ];

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
      <div className="p-4 md:p-8">
        <div className="flex items-center justify-center h-64">
          <p style={{ color: "var(--text-muted)" }}>Loading tasks...</p>
        </div>
      </div>
    );
  }

  if (error && tasks.length === 0) {
    return (
      <div className="p-4 md:p-8">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p style={{ color: "var(--status-blocked)" }}>Failed to load tasks: {error}</p>
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
            <ListTodo className="inline-block w-8 h-8 mr-2 mb-1" />
            Tasks
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
            Coordination board &bull; {scopedTasks.length} {projectFocus ? "in focus" : "tracked"} &bull; {inProgressCount} in progress &bull; {completedCount} completed
          </p>
          <p className="mt-2 text-sm" style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
            Use this page to track shared work across agents and projects. Task status here reflects backlog progress,
            not live runtime online/offline state.
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
          {showCreateForm ? "Close task intake" : "New task"}
        </button>
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
              Opened from Projects. Showing {focusedProjectTaskCount} linked task{focusedProjectTaskCount === 1 ? "" : "s"} before status filters.
            </p>
          </div>
          <a
            href="/agents/tasks"
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
                Create a tracked task
              </p>
              <p className="mt-1 text-sm" style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
                This first CRUD milestone keeps creation honest: title, board status, priority, due date, project,
                and initial owner all save here. Reviewer and handoff can still be added from the row-level routing editor after creation.
              </p>
              {projectFocus && (
                <p className="mt-2 text-xs" style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>
                  Opened from Projects for <span style={{ color: "var(--text-primary)" }}>{projectFocus}</span>; the project field starts with that label but stays editable here.
                </p>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <label className="flex flex-col gap-1.5 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                Title
                <input
                  value={newTitle}
                  onChange={(event) => setNewTitle(event.target.value)}
                  placeholder="Add a new task"
                  style={formInputStyle}
                />
              </label>

              <label className="flex flex-col gap-1.5 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                Project
                <input
                  value={newProject}
                  onChange={(event) => setNewProject(event.target.value)}
                  placeholder="Mission Control"
                  style={formInputStyle}
                />
              </label>

              <label className="flex flex-col gap-1.5 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                Due date
                <input
                  type="date"
                  value={newDueDate}
                  onChange={(event) => setNewDueDate(event.target.value)}
                  style={formInputStyle}
                />
              </label>

              <label className="flex flex-col gap-1.5 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                Initial status
                <select value={newStatus} onChange={(event) => setNewStatus(event.target.value as Task["status"])} style={formInputStyle}>
                  {Object.entries(taskStatusConfig).map(([value, config]) => (
                    <option key={value} value={value}>
                      {config.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                Priority
                <select value={newPriority} onChange={(event) => setNewPriority(event.target.value as Task["priority"])} style={formInputStyle}>
                  {Object.entries(taskPriorityConfig).map(([value, config]) => (
                    <option key={value} value={value}>
                      {config.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                Owner
                <select value={newAssigneeAgentId} onChange={(event) => setNewAssigneeAgentId(event.target.value)} style={formInputStyle}>
                  <option value="">Unassigned</option>
                  {initialTaskAgents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
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
                onClick={handleCreateTask}
                disabled={creatingTask}
                className="px-4 py-2 text-sm font-semibold rounded-lg transition-colors"
                style={{
                  backgroundColor: "var(--accent)",
                  color: "#000",
                  opacity: creatingTask ? 0.7 : 1,
                }}
              >
                {creatingTask ? "Creating..." : "Create task"}
              </button>
            </div>
          </div>
        </div>
      )}

      {(blockedCount > 0 || overdueCount > 0 || projectLabelMismatchCount > 0) && (
        <div
          className="mb-6 flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-xs"
          style={{
            backgroundColor: "var(--surface-elevated)",
            border: "1px solid var(--border)",
          }}
        >
          <span className="font-semibold" style={{ color: "var(--text-secondary)" }}>
            Needs attention
          </span>
          {blockedCount > 0 && (
            <span
              className="rounded-full px-2 py-1 font-semibold"
              style={{
                color: "var(--status-blocked)",
                backgroundColor: "color-mix(in srgb, var(--status-blocked) 14%, transparent)",
                border: "1px solid color-mix(in srgb, var(--status-blocked) 28%, transparent)",
              }}
            >
              {blockedCount} blocked
            </span>
          )}
          {overdueCount > 0 && (
            <span
              className="rounded-full px-2 py-1 font-semibold"
              style={{
                color: "#FF9F0A",
                backgroundColor: "color-mix(in srgb, #FF9F0A 16%, transparent)",
                border: "1px solid color-mix(in srgb, #FF9F0A 30%, transparent)",
              }}
            >
              {overdueCount} overdue
            </span>
          )}
          {projectLabelMismatchCount > 0 && (
            <>
              <span
                className="rounded-full px-2 py-1 font-semibold"
                style={{
                  color: "#FFD60A",
                  backgroundColor: "color-mix(in srgb, #FFD60A 16%, transparent)",
                  border: "1px solid color-mix(in srgb, #FFD60A 30%, transparent)",
                }}
              >
                {projectLabelMismatchCount} project label mismatch{projectLabelMismatchCount === 1 ? "" : "es"}
              </span>
              <span style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>
                {projectLabelMismatchPreview} Clean them up from the affected task rows so focused Projects navigation stays honest.
              </span>
              <button
                type="button"
                onClick={handleToggleMismatchOnly}
                className="rounded-full px-3 py-1 font-semibold transition-colors"
                style={{
                  color: showMismatchOnly ? "#111" : "#FFD60A",
                  backgroundColor: showMismatchOnly ? "#FFD60A" : "transparent",
                  border: "1px solid color-mix(in srgb, #FFD60A 36%, transparent)",
                }}
              >
                {showMismatchOnly ? "Show all visible tasks" : "Show mismatches only"}
              </button>
            </>
          )}
        </div>
      )}

      {hasAnyTasks ? (
        <>
          <div className="mb-6 flex flex-wrap gap-2">
            {filterButtons.map((button) => {
              const isActive = statusFilter === button.key;
              const statusColor = button.key !== "all" ? taskStatusConfig[button.key]?.color : undefined;
              return (
                <button
                  key={button.key}
                  onClick={() => setStatusFilter(button.key)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-full transition-all duration-150"
                  style={{
                    backgroundColor: isActive
                      ? statusColor
                        ? `color-mix(in srgb, ${statusColor} 20%, transparent)`
                        : "var(--surface-elevated)"
                      : "transparent",
                    color: isActive ? statusColor || "var(--text-primary)" : "var(--text-muted)",
                    border: isActive
                      ? `1px solid ${statusColor ? `color-mix(in srgb, ${statusColor} 40%, transparent)` : "var(--border-strong)"}`
                      : "1px solid var(--border)",
                  }}
                >
                  {button.label}
                  {button.key === "all" && ` (${scopedTasks.length})`}
                  {button.key !== "all" && ` (${scopedTasks.filter((task) => task.status === button.key).length})`}
                </button>
              );
            })}
            {showMismatchOnly && (
              <button
                type="button"
                onClick={handleToggleMismatchOnly}
                className="text-xs font-semibold px-3 py-1.5 rounded-full transition-all duration-150"
                style={{
                  backgroundColor: "color-mix(in srgb, #FFD60A 18%, transparent)",
                  color: "#FFD60A",
                  border: "1px solid color-mix(in srgb, #FFD60A 34%, transparent)",
                }}
              >
                Mismatches only ({projectLabelMismatchCount})
              </button>
            )}
          </div>

          <div
            className="rounded-xl overflow-hidden"
            style={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
            }}
          >
            <div
              className="flex items-center gap-3 px-4 py-2.5"
              style={{
                borderBottom: "1px solid var(--border)",
                backgroundColor: "var(--surface-elevated)",
              }}
            >
              {columns.map((column, index) => (
                <div
                  key={index}
                  className={`${column.flex} flex items-center gap-1 ${column.key ? "cursor-pointer select-none" : ""}`}
                  onClick={() => column.key && toggleSort(column.key)}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                    {column.label}
                  </span>
                  {column.key && sortField === column.key && (
                    <ArrowUpDown
                      className="w-3 h-3"
                      style={{
                        color: "var(--text-secondary)",
                        transform: sortDir === "desc" ? "scaleY(-1)" : undefined,
                      }}
                    />
                  )}
                </div>
              ))}
            </div>

            {filteredTasks.length > 0 ? (
              filteredTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  agentOptions={initialTaskAgents}
                  allTasks={tasks}
                  hasProjectTitleMatch={canCheckProjectMatches ? normalizedProjectTitles.has(normalizeProjectLabel(task.project)) : null}
                  onUpdate={refetch}
                />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
                <div className="space-y-1">
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    {showMismatchOnly
                      ? "No project label mismatches in this view"
                      : projectFocus && !hasFocusedTasks
                        ? `No tasks linked to ${projectFocus} yet`
                        : `No ${activeFilterLabel.toLowerCase()} tasks right now`}
                  </p>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    {showMismatchOnly
                      ? projectFocus
                        ? `Every visible task in the ${projectFocus} focus currently matches an exact Projects title, so there is no label drift to clean up here.`
                        : "Every visible task currently matches an exact Projects title, so the mismatch-only filter has nothing left to show."
                      : projectFocus
                        ? hasFocusedTasks
                          ? `The ${projectFocus} focus is active, and the current status filter is not showing any matching tasks.`
                          : `This project focus is active, but no task currently carries the ${projectFocus} project label from the Tasks board yet.`
                        : `The board still has ${tasks.length} tracked task${tasks.length === 1 ? "" : "s"}; this filter just is not showing any of them.`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    onClick={() => setStatusFilter("all")}
                    className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
                    style={{
                      backgroundColor: "var(--surface-elevated)",
                      color: "var(--text-primary)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    Show all statuses
                  </button>
                  {showMismatchOnly && (
                    <button
                      type="button"
                      onClick={handleToggleMismatchOnly}
                      className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
                      style={{
                        backgroundColor: "transparent",
                        color: "#FFD60A",
                        border: "1px solid color-mix(in srgb, #FFD60A 34%, transparent)",
                      }}
                    >
                      Show all visible tasks
                    </button>
                  )}
                  {projectFocus && (
                    <button
                      onClick={() => {
                        resetCreateForm();
                        setStatusFilter("all");
                        setShowCreateForm(true);
                      }}
                      className="px-4 py-2 text-sm font-semibold rounded-lg transition-colors"
                      style={{
                        backgroundColor: "var(--accent)",
                        color: "#000",
                      }}
                    >
                      Create task for this project
                    </button>
                  )}
                  {projectFocus && (
                    <a
                      href="/agents/tasks"
                      className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
                      style={{
                        backgroundColor: "transparent",
                        color: "#0A84FF",
                        border: "1px solid color-mix(in srgb, #0A84FF 28%, transparent)",
                      }}
                    >
                      Clear project focus
                    </a>
                  )}
                </div>
                {projectFocus && (
                  <p className="max-w-md text-xs" style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>
                    The intake form opens with <span style={{ color: "var(--text-primary)" }}>{projectFocus}</span> prefilled as the project label, but you can still change it before saving.
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        <div
          className="rounded-xl px-6 py-12 text-center"
          style={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="mx-auto max-w-md space-y-3">
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              No tracked tasks yet
            </p>
            <p className="text-sm" style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
              This coordination board is ready for real intake now. Create the first task to start tracking owner,
              board status, priority, project, and due date from Mission Control instead of editing JSON by hand.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setShowCreateForm(true)}
                className="px-4 py-2 text-sm font-semibold rounded-lg transition-colors"
                style={{
                  backgroundColor: "var(--accent)",
                  color: "#000",
                }}
              >
                Create first task
              </button>
              <button
                onClick={refetch}
                className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
                style={{
                  backgroundColor: "var(--surface-elevated)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border)",
                }}
              >
                Refresh board
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
