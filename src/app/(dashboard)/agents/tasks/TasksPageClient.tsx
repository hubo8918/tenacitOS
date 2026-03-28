"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowUpDown, Plus } from "lucide-react";

import type { ReviewDecisionSubmitPayload } from "@/components/ReviewDecisionComposer";
import { TaskRow } from "@/components/TaskRow";
import { WorkItemInspector } from "@/components/WorkItemInspector";
import type { Project } from "@/data/mockProjectsData";
import type { Task } from "@/data/mockTasksData";
import { taskPriorityConfig, taskStatusConfig } from "@/data/mockTasksData";
import {
  normalizeProjectLabel,
  resolveProjectForTask,
  taskHasProjectMismatch,
  taskLinksToProject,
} from "@/lib/project-task-linkage";
import { useFetch } from "@/lib/useFetch";

type StatusFilter = "all" | Task["status"];

const customProjectSentinel = "__custom__";

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

function getLocalDateInputValue(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function sameStringList(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export default function TasksPageClient({
  initialTasks,
  initialTaskAgents,
  initialProjects,
}: TasksPageClientProps) {
  const searchParams = useSearchParams();
  const requestedTaskId = searchParams.get("taskId")?.trim() || searchParams.get("task")?.trim() || "";
  const focusedProjectId = searchParams.get("projectId")?.trim() || "";
  const focusedProjectLabel = searchParams.get("project")?.trim() || "";
  const focusedAgentId = searchParams.get("agentId")?.trim() || "";
  const focusedReviewerId = searchParams.get("reviewerId")?.trim() || "";
  const mismatchOnlyRequested = searchParams.get("mismatch") === "1";

  const { data, loading, error, refetch } = useFetch<{ tasks: Task[] }>("/api/agent-tasks", {
    initialData: initialTasks.length > 0 ? { tasks: initialTasks } : null,
    fetchOnMount: initialTasks.length === 0,
  });
  const { data: projectsData } = useFetch<{ projects: Project[] }>("/api/projects", {
    initialData: initialProjects.length > 0 ? { projects: initialProjects } : null,
    fetchOnMount: initialProjects.length === 0,
  });

  const tasks = useMemo(() => data?.tasks || [], [data]);
  const projects = useMemo(() => projectsData?.projects || initialProjects, [initialProjects, projectsData]);
  const taskAgents = useMemo(
    () => [...initialTaskAgents].sort((left, right) => left.name.localeCompare(right.name)),
    [initialTaskAgents]
  );
  const focusedAgentName = focusedAgentId
    ? taskAgents.find((agent) => agent.id === focusedAgentId)?.name || focusedAgentId
    : "";
  const focusedReviewerName = focusedReviewerId
    ? taskAgents.find((agent) => agent.id === focusedReviewerId)?.name || focusedReviewerId
    : "";
  const projectOptions = useMemo(
    () =>
      [...projects]
        .map((project) => ({ id: project.id, title: project.title }))
        .sort((left, right) => left.title.localeCompare(right.title)),
    [projects]
  );
  const selectedFocusedProject = useMemo(
    () => projects.find((project) => project.id === focusedProjectId) || null,
    [focusedProjectId, projects]
  );
  const normalizedFocusedProjectLabel = normalizeProjectLabel(
    selectedFocusedProject?.title || focusedProjectLabel
  );

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showMismatchOnly, setShowMismatchOnly] = useState(mismatchOnlyRequested);
  const [selectedTaskId, setSelectedTaskId] = useState(requestedTaskId);
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);
  const [pendingSelectionTaskId, setPendingSelectionTaskId] = useState<string | null>(null);
  const [selectionBlockMessage, setSelectionBlockMessage] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newProjectLabel, setNewProjectLabel] = useState(selectedFocusedProject?.title || focusedProjectLabel || "");
  const [newProjectLinkMode, setNewProjectLinkMode] = useState(selectedFocusedProject?.id || "");
  const [newDueDate, setNewDueDate] = useState(() => getLocalDateInputValue(7));
  const [newStatus, setNewStatus] = useState<Task["status"]>("pending");
  const [newPriority, setNewPriority] = useState<Task["priority"]>("medium");
  const [newAssigneeAgentId, setNewAssigneeAgentId] = useState("");

  const [detailTitle, setDetailTitle] = useState("");
  const [detailProjectLabel, setDetailProjectLabel] = useState("");
  const [detailProjectLinkMode, setDetailProjectLinkMode] = useState("");
  const [detailDueDate, setDetailDueDate] = useState("");
  const [detailStatus, setDetailStatus] = useState<Task["status"]>("pending");
  const [detailPriority, setDetailPriority] = useState<Task["priority"]>("medium");
  const [detailError, setDetailError] = useState<string | null>(null);
  const [savingDetails, setSavingDetails] = useState(false);
  const [deletingTask, setDeletingTask] = useState(false);

  const [routingOwnerAgentId, setRoutingOwnerAgentId] = useState("");
  const [routingReviewerAgentId, setRoutingReviewerAgentId] = useState("");
  const [routingHandoffToAgentId, setRoutingHandoffToAgentId] = useState("");
  const [routingBlockedByIds, setRoutingBlockedByIds] = useState<string[]>([]);
  const [routingError, setRoutingError] = useState<string | null>(null);
  const [savingRouting, setSavingRouting] = useState(false);

  const [requestingPacket, setRequestingPacket] = useState(false);
  const [taskReviewPending, setTaskReviewPending] = useState<"approve" | "rework" | "block" | null>(null);
  const [workItemError, setWorkItemError] = useState<string | null>(null);
  const [inspectorRefreshNonce, setInspectorRefreshNonce] = useState(0);

  const scopedTasks = useMemo(() => {
    if (selectedFocusedProject) {
      return tasks.filter((task) => taskLinksToProject(task, selectedFocusedProject));
    }

    if (normalizedFocusedProjectLabel) {
      return tasks.filter((task) => normalizeProjectLabel(task.project) === normalizedFocusedProjectLabel);
    }

    return tasks;
  }, [normalizedFocusedProjectLabel, selectedFocusedProject, tasks]);

  const mismatchTaskIds = useMemo(
    () => new Set(scopedTasks.filter((task) => taskHasProjectMismatch(task, projects)).map((task) => task.id)),
    [projects, scopedTasks]
  );

  const visibleTasks = useMemo(() => {
    const loweredQuery = query.trim().toLowerCase();

    return scopedTasks
      .filter((task) =>
        focusedAgentId ? (task.assigneeAgentId || task.agent.id || "") === focusedAgentId : true
      )
      .filter((task) =>
        focusedReviewerId ? (task.reviewerAgentId || "") === focusedReviewerId : true
      )
      .filter((task) => (showMismatchOnly ? mismatchTaskIds.has(task.id) : true))
      .filter((task) => (statusFilter === "all" ? true : task.status === statusFilter))
      .filter((task) => {
        if (!loweredQuery) return true;
        return [task.title, task.project, task.agent.name, task.assigneeAgentId || "", task.reviewerAgentId || ""]
          .join(" ")
          .toLowerCase()
          .includes(loweredQuery);
      })
      .sort((left, right) => {
        const leftNeedsReview = left.runStatus === "needs_review" ? 0 : 1;
        const rightNeedsReview = right.runStatus === "needs_review" ? 0 : 1;
        if (leftNeedsReview !== rightNeedsReview) return leftNeedsReview - rightNeedsReview;
        return left.title.localeCompare(right.title);
      });
  }, [focusedAgentId, focusedReviewerId, mismatchTaskIds, query, scopedTasks, showMismatchOnly, statusFilter]);

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) || null,
    [selectedTaskId, tasks]
  );
  const selectedLinkedProject = useMemo(
    () => (selectedTask ? resolveProjectForTask(selectedTask, projects) : null),
    [projects, selectedTask]
  );
  const selectedProjectLabel = selectedLinkedProject?.title || selectedTask?.project || "";
  const selectedTaskVisible = useMemo(
    () => visibleTasks.some((task) => task.id === selectedTaskId),
    [selectedTaskId, visibleTasks]
  );
  const detailTrackedProject = useMemo(
    () => projectOptions.find((project) => project.id === detailProjectLinkMode) || null,
    [detailProjectLinkMode, projectOptions]
  );
  const createTrackedProject = useMemo(
    () => projectOptions.find((project) => project.id === newProjectLinkMode) || null,
    [newProjectLinkMode, projectOptions]
  );

  const detailsDirty = useMemo(() => {
    if (!selectedTask) return false;
    const currentProjectLabel = selectedLinkedProject?.title || selectedTask.project || "";
    const currentProjectLinkMode = selectedLinkedProject?.id || (selectedTask.project ? customProjectSentinel : "");
    return (
      detailTitle !== selectedTask.title ||
      detailProjectLabel !== currentProjectLabel ||
      detailProjectLinkMode !== currentProjectLinkMode ||
      detailDueDate !== selectedTask.dueDate ||
      detailStatus !== selectedTask.status ||
      detailPriority !== selectedTask.priority
    );
  }, [
    detailDueDate,
    detailPriority,
    detailProjectLabel,
    detailProjectLinkMode,
    detailStatus,
    detailTitle,
    selectedLinkedProject,
    selectedTask,
  ]);

  const routingDirty = useMemo(() => {
    if (!selectedTask) return false;
    return (
      routingOwnerAgentId !== (selectedTask.assigneeAgentId || selectedTask.agent.id || "") ||
      routingReviewerAgentId !== (selectedTask.reviewerAgentId || "") ||
      routingHandoffToAgentId !== (selectedTask.handoffToAgentId || "") ||
      !sameStringList(routingBlockedByIds, selectedTask.blockedByTaskIds || [])
    );
  }, [routingBlockedByIds, routingHandoffToAgentId, routingOwnerAgentId, routingReviewerAgentId, selectedTask]);

  const hasDirtyPlanning = detailsDirty || routingDirty;

  useEffect(() => {
    setShowMismatchOnly(mismatchOnlyRequested);
  }, [mismatchOnlyRequested]);

  useEffect(() => {
    if (!selectedTask && visibleTasks.length > 0 && !hasDirtyPlanning) {
      setSelectedTaskId(visibleTasks[0].id);
      return;
    }

    if (selectedTask && !selectedTaskVisible && visibleTasks.length > 0 && !hasDirtyPlanning) {
      setSelectedTaskId(visibleTasks[0].id);
    }
  }, [hasDirtyPlanning, selectedTask, selectedTaskVisible, visibleTasks]);

  useEffect(() => {
    if (!requestedTaskId) return;
    if (requestedTaskId === selectedTaskId) return;

    if (hasDirtyPlanning) {
      setPendingSelectionTaskId(requestedTaskId);
      setSelectionBlockMessage("Save or cancel planning edits before switching tasks.");
      return;
    }

    if (tasks.some((task) => task.id === requestedTaskId)) {
      setSelectedTaskId(requestedTaskId);
    }
  }, [hasDirtyPlanning, requestedTaskId, selectedTaskId, tasks]);

  useEffect(() => {
    if (!selectedTask || hasDirtyPlanning) return;

    const linkedProject = resolveProjectForTask(selectedTask, projects);
    setDetailTitle(selectedTask.title);
    setDetailProjectLabel(linkedProject?.title || selectedTask.project || "");
    setDetailProjectLinkMode(linkedProject?.id || (selectedTask.project ? customProjectSentinel : ""));
    setDetailDueDate(selectedTask.dueDate);
    setDetailStatus(selectedTask.status);
    setDetailPriority(selectedTask.priority);
    setDetailError(null);
    setRoutingOwnerAgentId(selectedTask.assigneeAgentId || selectedTask.agent.id || "");
    setRoutingReviewerAgentId(selectedTask.reviewerAgentId || "");
    setRoutingHandoffToAgentId(selectedTask.handoffToAgentId || "");
    setRoutingBlockedByIds([...(selectedTask.blockedByTaskIds || [])]);
    setRoutingError(null);
  }, [hasDirtyPlanning, projects, selectedTask]);

  useEffect(() => {
    if (!selectedTaskId) return;
    const target = document.getElementById(`task-row-${selectedTaskId}`);
    if (!target) return;

    window.requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedTaskId(selectedTaskId);
    });
  }, [selectedTaskId]);

  useEffect(() => {
    if (!highlightedTaskId) return;
    const timeout = window.setTimeout(() => setHighlightedTaskId(null), 2500);
    return () => window.clearTimeout(timeout);
  }, [highlightedTaskId]);

  const resetDetailsDraft = () => {
    if (!selectedTask) return;
    const linkedProject = resolveProjectForTask(selectedTask, projects);
    setDetailTitle(selectedTask.title);
    setDetailProjectLabel(linkedProject?.title || selectedTask.project || "");
    setDetailProjectLinkMode(linkedProject?.id || (selectedTask.project ? customProjectSentinel : ""));
    setDetailDueDate(selectedTask.dueDate);
    setDetailStatus(selectedTask.status);
    setDetailPriority(selectedTask.priority);
    setDetailError(null);
  };

  const resetRoutingDraft = () => {
    if (!selectedTask) return;
    setRoutingOwnerAgentId(selectedTask.assigneeAgentId || selectedTask.agent.id || "");
    setRoutingReviewerAgentId(selectedTask.reviewerAgentId || "");
    setRoutingHandoffToAgentId(selectedTask.handoffToAgentId || "");
    setRoutingBlockedByIds([...(selectedTask.blockedByTaskIds || [])]);
    setRoutingError(null);
  };

  const clearSelectionBlock = () => {
    setPendingSelectionTaskId(null);
    setSelectionBlockMessage(null);
  };

  const applyPendingSelection = () => {
    if (!pendingSelectionTaskId) return;
    setSelectedTaskId(pendingSelectionTaskId);
    clearSelectionBlock();
  };

  const handleSelectTask = (taskId: string) => {
    if (taskId === selectedTaskId) return;
    if (hasDirtyPlanning) {
      setPendingSelectionTaskId(taskId);
      setSelectionBlockMessage("Save or cancel planning edits before switching tasks.");
      return;
    }

    setSelectedTaskId(taskId);
    clearSelectionBlock();
  };

  const dependencyOptions = useMemo(
    () =>
      tasks
        .filter((task) => task.id !== selectedTask?.id)
        .sort((left, right) => left.title.localeCompare(right.title)),
    [selectedTask?.id, tasks]
  );

  const handleSaveDetails = async () => {
    if (!selectedTask) return;

    const trimmedTitle = detailTitle.trim();
    const trimmedProjectLabel = detailProjectLabel.trim();
    if (!trimmedTitle) {
      setDetailError("Task title is required.");
      return;
    }
    if (!detailDueDate) {
      setDetailError("Due date is required.");
      return;
    }
    if (detailProjectLinkMode === customProjectSentinel && !trimmedProjectLabel) {
      setDetailError("Custom project label is required, or switch to a tracked project.");
      return;
    }

    setSavingDetails(true);
    setDetailError(null);

    try {
      const response = await fetch("/api/agent-tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedTask.id,
          title: trimmedTitle,
          project: detailTrackedProject ? detailTrackedProject.title : trimmedProjectLabel,
          projectId:
            detailProjectLinkMode === customProjectSentinel
              ? null
              : detailTrackedProject?.id || null,
          dueDate: detailDueDate,
          status: detailStatus,
          priority: detailPriority,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to save task details");
      }

      await refetch();
      setInspectorRefreshNonce((current) => current + 1);
      applyPendingSelection();
    } catch (saveError) {
      setDetailError(saveError instanceof Error ? saveError.message : "Failed to save task details");
    } finally {
      setSavingDetails(false);
    }
  };

  const handleSaveRouting = async () => {
    if (!selectedTask) return;

    if (routingOwnerAgentId && routingReviewerAgentId && routingOwnerAgentId === routingReviewerAgentId) {
      setRoutingError("Reviewer must be different from the owner.");
      return;
    }
    if (routingOwnerAgentId && routingHandoffToAgentId && routingOwnerAgentId === routingHandoffToAgentId) {
      setRoutingError("Handoff target must be different from the owner.");
      return;
    }

    setSavingRouting(true);
    setRoutingError(null);

    try {
      const owner = taskAgents.find((agent) => agent.id === routingOwnerAgentId) || null;
      const response = await fetch("/api/agent-tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedTask.id,
          assigneeAgentId: routingOwnerAgentId || undefined,
          reviewerAgentId: routingReviewerAgentId || undefined,
          handoffToAgentId: routingHandoffToAgentId || undefined,
          blockedByTaskIds: routingBlockedByIds,
          agent: owner
            ? {
                id: owner.id,
                name: owner.name,
                emoji: owner.emoji,
                color: owner.color,
              }
            : {
                name: "Unassigned",
                emoji: " ",
                color: "#8E8E93",
              },
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to save task routing");
      }

      await refetch();
      setInspectorRefreshNonce((current) => current + 1);
      applyPendingSelection();
    } catch (saveError) {
      setRoutingError(saveError instanceof Error ? saveError.message : "Failed to save task routing");
    } finally {
      setSavingRouting(false);
    }
  };

  const handleCreateTask = async () => {
    const trimmedTitle = newTitle.trim();
    const trimmedProjectLabel = newProjectLabel.trim();
    if (!trimmedTitle) {
      setCreateError("Task title is required.");
      return;
    }
    if (!newDueDate) {
      setCreateError("Due date is required.");
      return;
    }
    if (newProjectLinkMode === customProjectSentinel && !trimmedProjectLabel) {
      setCreateError("Custom project label is required.");
      return;
    }

    setCreatingTask(true);
    setCreateError(null);

    try {
      const owner = taskAgents.find((agent) => agent.id === newAssigneeAgentId) || null;
      const response = await fetch("/api/agent-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmedTitle,
          project: createTrackedProject ? createTrackedProject.title : trimmedProjectLabel,
          projectId: newProjectLinkMode === customProjectSentinel ? null : createTrackedProject?.id || null,
          dueDate: newDueDate,
          status: newStatus,
          priority: newPriority,
          assigneeAgentId: owner?.id || undefined,
          agent: owner
            ? {
                id: owner.id,
                name: owner.name,
                emoji: owner.emoji,
                color: owner.color,
              }
            : {
                name: "Unassigned",
                emoji: " ",
                color: "#8E8E93",
              },
        }),
      });

      const payload = (await response.json().catch(() => null)) as (Task & { error?: string }) | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to create task");
      }

      await refetch();
      setSelectedTaskId(payload?.id || "");
      setShowCreateForm(false);
      setNewTitle("");
      setNewProjectLabel(selectedFocusedProject?.title || focusedProjectLabel || "");
      setNewProjectLinkMode(selectedFocusedProject?.id || "");
      setNewDueDate(getLocalDateInputValue(7));
      setNewStatus("pending");
      setNewPriority("medium");
      setNewAssigneeAgentId("");
      setInspectorRefreshNonce((current) => current + 1);
    } catch (createTaskError) {
      setCreateError(createTaskError instanceof Error ? createTaskError.message : "Failed to create task");
    } finally {
      setCreatingTask(false);
    }
  };

  const handleRequestPacket = async () => {
    if (!selectedTask) return;
    if (!selectedTask.assigneeAgentId && !selectedTask.agent.id) {
      setWorkItemError("Assign an owner before requesting a packet.");
      return;
    }

    setRequestingPacket(true);
    setWorkItemError(null);

    try {
      const reviewerName =
        taskAgents.find((agent) => agent.id === selectedTask.reviewerAgentId)?.name ||
        selectedTask.reviewerAgentId ||
        null;
      const handoffName =
        taskAgents.find((agent) => agent.id === selectedTask.handoffToAgentId)?.name ||
        selectedTask.handoffToAgentId ||
        null;
      const blockers = (selectedTask.blockedByTaskIds || [])
        .map((taskId) => tasks.find((task) => task.id === taskId)?.title || taskId)
        .filter(Boolean);
      const response = await fetch("/api/team/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedTask.assigneeAgentId || selectedTask.agent.id,
          action: "check-in",
          task: {
            id: selectedTask.id,
            title: selectedTask.title,
            project: selectedProjectLabel || null,
            status: selectedTask.status,
            priority: selectedTask.priority,
            dueDate: selectedTask.dueDate,
            owner: selectedTask.agent.name !== "Unassigned" ? selectedTask.agent.name : null,
            reviewer: reviewerName,
            handoff: handoffName,
            blockers,
          },
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to request owner packet");
      }

      await refetch();
      setInspectorRefreshNonce((current) => current + 1);
    } catch (packetError) {
      setWorkItemError(packetError instanceof Error ? packetError.message : "Failed to request owner packet");
    } finally {
      setRequestingPacket(false);
    }
  };

  const handleReviewSubmit = async ({ decision, note, handoffTo }: ReviewDecisionSubmitPayload) => {
    if (!selectedTask) return;

    setTaskReviewPending(decision);
    setWorkItemError(null);

    try {
      const response = await fetch("/api/work-items/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "task",
          itemId: selectedTask.id,
          decision,
          note,
          handoffTo: handoffTo || undefined,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to save review decision");
      }

      await refetch();
      setInspectorRefreshNonce((current) => current + 1);
    } catch (reviewError) {
      const message = reviewError instanceof Error ? reviewError.message : "Failed to save review decision";
      setWorkItemError(message);
      throw reviewError instanceof Error ? reviewError : new Error(message);
    } finally {
      setTaskReviewPending(null);
    }
  };

  const handleDeleteTask = async () => {
    if (!selectedTask || deletingTask) return;
    const confirmed = window.confirm(`Delete task "${selectedTask.title}"?`);
    if (!confirmed) return;

    setDeletingTask(true);
    setDetailError(null);
    setRoutingError(null);

    try {
      const response = await fetch(`/api/agent-tasks?id=${encodeURIComponent(selectedTask.id)}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to delete task");
      }

      setSelectedTaskId("");
      await refetch();
      setInspectorRefreshNonce((current) => current + 1);
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Failed to delete task";
      setDetailError(message);
    } finally {
      setDeletingTask(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Task Planning
          </p>
          <h1 className="mt-1 text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
            Tasks
          </h1>
          <p className="mt-2 max-w-3xl text-sm" style={{ color: "var(--text-muted)", lineHeight: 1.7 }}>
            Keep the board focused on planning. Select a task to edit details and routing, then use the inspector for packet history and review decisions.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowCreateForm((current) => !current);
            setCreateError(null);
          }}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold"
          style={{ backgroundColor: "var(--accent)", color: "#111" }}
        >
          <Plus className="h-4 w-4" />
          {showCreateForm ? "Close create form" : "Create task"}
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-5">
        <div className="rounded-xl p-4" style={{ backgroundColor: "var(--surface-elevated)", border: "1px solid var(--border)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Visible tasks
          </p>
          <p className="mt-2 text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
            {visibleTasks.length}
          </p>
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: "var(--surface-elevated)", border: "1px solid var(--border)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Needs review
          </p>
          <p className="mt-2 text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
            {tasks.filter((task) => task.runStatus === "needs_review").length}
          </p>
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: "var(--surface-elevated)", border: "1px solid var(--border)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Blocked
          </p>
          <p className="mt-2 text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
            {tasks.filter((task) => task.status === "blocked").length}
          </p>
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: "var(--surface-elevated)", border: "1px solid var(--border)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Project links
          </p>
          <p className="mt-2 text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
            {tasks.filter((task) => Boolean(resolveProjectForTask(task, projects))).length}
          </p>
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: "var(--surface-elevated)", border: "1px solid var(--border)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Filters
          </p>
          <p className="mt-2 text-sm" style={{ color: "var(--text-primary)" }}>
            {statusFilter === "all" ? "All statuses" : taskStatusConfig[statusFilter].label}
            {showMismatchOnly ? " · mismatches only" : ""}
          </p>
        </div>
      </div>

      {showCreateForm && (
        <div className="rounded-xl p-4" style={{ backgroundColor: "var(--surface-elevated)", border: "1px solid var(--border)" }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Create task
              </p>
              <p className="mt-1 text-sm" style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
                New tasks open straight into planning. Link them to a tracked project here or keep a custom label.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
              Title
              <input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "var(--card)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
              Tracked project
              <select value={newProjectLinkMode} onChange={(event) => setNewProjectLinkMode(event.target.value)} className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "var(--card)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                <option value="">No project</option>
                {projectOptions.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
                <option value={customProjectSentinel}>Custom label</option>
              </select>
            </label>
            {newProjectLinkMode === customProjectSentinel && (
              <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                Custom project label
                <input value={newProjectLabel} onChange={(event) => setNewProjectLabel(event.target.value)} className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "var(--card)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
              </label>
            )}
            <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
              Due date
              <input type="date" value={newDueDate} onChange={(event) => setNewDueDate(event.target.value)} className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "var(--card)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
              Status
              <select value={newStatus} onChange={(event) => setNewStatus(event.target.value as Task["status"])} className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "var(--card)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                {Object.entries(taskStatusConfig).map(([value, config]) => (
                  <option key={value} value={value}>
                    {config.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
              Priority
              <select value={newPriority} onChange={(event) => setNewPriority(event.target.value as Task["priority"])} className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "var(--card)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                {Object.entries(taskPriorityConfig).map(([value, config]) => (
                  <option key={value} value={value}>
                    {config.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
              Owner
              <select value={newAssigneeAgentId} onChange={(event) => setNewAssigneeAgentId(event.target.value)} className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "var(--card)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                <option value="">Unassigned</option>
                {taskAgents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {createError && (
            <p className="mt-3 text-sm" style={{ color: "var(--status-blocked)" }}>
              {createError}
            </p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setShowCreateForm(false)} className="rounded-lg px-4 py-2 text-sm font-semibold" style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
              Cancel
            </button>
            <button type="button" onClick={handleCreateTask} disabled={creatingTask} className="rounded-lg px-4 py-2 text-sm font-semibold" style={{ backgroundColor: "var(--accent)", color: "#111", opacity: creatingTask ? 0.6 : 1 }}>
              {creatingTask ? "Creating..." : "Create task"}
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <div className="space-y-4">
          <div className="rounded-xl p-4" style={{ backgroundColor: "var(--surface-elevated)", border: "1px solid var(--border)" }}>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search tasks, projects, owners, reviewers..."
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ backgroundColor: "var(--card)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                />
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                <ArrowUpDown className="h-4 w-4" />
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "var(--card)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                  <option value="all">All statuses</option>
                  {Object.entries(taskStatusConfig).map(([value, config]) => (
                    <option key={value} value={value}>
                      {config.label}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={() => setShowMismatchOnly((current) => !current)} className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ color: showMismatchOnly ? "#0A84FF" : "var(--text-secondary)", border: "1px solid var(--border)", backgroundColor: showMismatchOnly ? "color-mix(in srgb, #0A84FF 10%, transparent)" : "transparent" }}>
                {showMismatchOnly ? "Showing mismatches" : "Show mismatches"}
              </button>
            </div>
            {(focusedAgentId || focusedReviewerId) && (
              <div
                className="mt-3 rounded-lg p-3 text-sm"
                style={{ backgroundColor: "color-mix(in srgb, #0A84FF 10%, var(--card))", border: "1px solid color-mix(in srgb, #0A84FF 22%, transparent)", color: "var(--text-secondary)" }}
              >
                Showing
                {focusedAgentId ? ` tasks owned by ${focusedAgentName}` : ""}
                {focusedAgentId && focusedReviewerId ? " and" : ""}
                {focusedReviewerId ? ` tasks reviewed by ${focusedReviewerName}` : ""}.
              </div>
            )}
            {error && (
              <p className="mt-3 text-sm" style={{ color: "var(--status-blocked)" }}>
                {error}
              </p>
            )}
          </div>

          <div className="space-y-3">
            {loading && visibleTasks.length === 0 ? (
              <div className="rounded-xl p-4" style={{ backgroundColor: "var(--surface-elevated)", border: "1px solid var(--border)" }}>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Loading tasks...
                </p>
              </div>
            ) : visibleTasks.length === 0 ? (
              <div className="rounded-xl p-4" style={{ backgroundColor: "var(--surface-elevated)", border: "1px solid var(--border)" }}>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  No tasks match the current filters.
                </p>
              </div>
            ) : (
              visibleTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  rowId={`task-row-${task.id}`}
                  task={task}
                  linkedProjectTitle={resolveProjectForTask(task, projects)?.title || null}
                  hasProjectLink={Boolean(resolveProjectForTask(task, projects))}
                  isSelected={task.id === selectedTaskId}
                  isTemporarilyHighlighted={task.id === highlightedTaskId}
                  onSelect={() => handleSelectTask(task.id)}
                />
              ))
            )}
          </div>
        </div>

        <div className="space-y-4">
          {selectionBlockMessage && (
            <div className="rounded-xl p-4" style={{ backgroundColor: "color-mix(in srgb, #FF9F0A 10%, var(--surface-elevated))", border: "1px solid color-mix(in srgb, #FF9F0A 24%, transparent)" }}>
              <p className="text-sm font-semibold" style={{ color: "#FF9F0A" }}>
                Planning changes are still unsaved
              </p>
              <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
                {selectionBlockMessage}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={applyPendingSelection} disabled={hasDirtyPlanning} className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ color: "#111", backgroundColor: "#FF9F0A", opacity: hasDirtyPlanning ? 0.6 : 1 }}>
                  Switch now
                </button>
                <button type="button" onClick={clearSelectionBlock} className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                  Stay here
                </button>
              </div>
            </div>
          )}

          <div className="rounded-xl p-4" style={{ backgroundColor: "var(--surface-elevated)", border: "1px solid var(--border)" }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Planning
            </p>
            {selectedTask ? (
              <div className="mt-3 space-y-5">
                <section>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                        Task details
                      </p>
                      <p className="mt-1 text-sm" style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
                        Core board fields live here. This stays separate from routing so the planning surface stays honest.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                      Title
                      <input value={detailTitle} onChange={(event) => setDetailTitle(event.target.value)} className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "var(--card)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                      Tracked project
                      <select value={detailProjectLinkMode} onChange={(event) => setDetailProjectLinkMode(event.target.value)} className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "var(--card)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                        <option value="">No project</option>
                        {projectOptions.map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.title}
                          </option>
                        ))}
                        <option value={customProjectSentinel}>Custom label</option>
                      </select>
                    </label>
                    {detailProjectLinkMode === customProjectSentinel && (
                      <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                        Custom project label
                        <input value={detailProjectLabel} onChange={(event) => setDetailProjectLabel(event.target.value)} className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "var(--card)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
                      </label>
                    )}
                    <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                      Due date
                      <input type="date" value={detailDueDate} onChange={(event) => setDetailDueDate(event.target.value)} className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "var(--card)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                      Status
                      <select value={detailStatus} onChange={(event) => setDetailStatus(event.target.value as Task["status"])} className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "var(--card)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                        {Object.entries(taskStatusConfig).map(([value, config]) => (
                          <option key={value} value={value}>
                            {config.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                      Priority
                      <select value={detailPriority} onChange={(event) => setDetailPriority(event.target.value as Task["priority"])} className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "var(--card)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                        {Object.entries(taskPriorityConfig).map(([value, config]) => (
                          <option key={value} value={value}>
                            {config.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {detailError && (
                    <p className="mt-3 text-sm" style={{ color: "var(--status-blocked)" }}>
                      {detailError}
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap justify-between gap-2">
                    <button type="button" onClick={handleDeleteTask} disabled={deletingTask} className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ color: "#FF453A", border: "1px solid color-mix(in srgb, #FF453A 24%, transparent)", opacity: deletingTask ? 0.6 : 1 }}>
                      {deletingTask ? "Deleting..." : "Delete task"}
                    </button>
                    <div className="flex gap-2">
                      <button type="button" onClick={resetDetailsDraft} className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                        Cancel details
                      </button>
                      <button type="button" onClick={handleSaveDetails} disabled={savingDetails || !detailsDirty} className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ backgroundColor: "var(--accent)", color: "#111", opacity: savingDetails || !detailsDirty ? 0.6 : 1 }}>
                        {savingDetails ? "Saving..." : "Save details"}
                      </button>
                    </div>
                  </div>
                </section>

                <section>
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    Task routing
                  </p>
                  <p className="mt-1 text-sm" style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
                    Owner, reviewer, handoff, and blockers stay together here so the execution contract is explicit.
                  </p>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                      Owner
                      <select value={routingOwnerAgentId} onChange={(event) => setRoutingOwnerAgentId(event.target.value)} className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "var(--card)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                        <option value="">Unassigned</option>
                        {taskAgents.map((agent) => (
                          <option key={agent.id} value={agent.id}>
                            {agent.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                      Reviewer
                      <select value={routingReviewerAgentId} onChange={(event) => setRoutingReviewerAgentId(event.target.value)} className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "var(--card)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                        <option value="">Unassigned</option>
                        {taskAgents.map((agent) => (
                          <option key={agent.id} value={agent.id}>
                            {agent.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                      Handoff target
                      <select value={routingHandoffToAgentId} onChange={(event) => setRoutingHandoffToAgentId(event.target.value)} className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "var(--card)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                        <option value="">None</option>
                        {taskAgents.map((agent) => (
                          <option key={agent.id} value={agent.id}>
                            {agent.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                      Blocking tasks
                      <select
                        multiple
                        value={routingBlockedByIds}
                        onChange={(event) =>
                          setRoutingBlockedByIds(
                            Array.from(event.target.selectedOptions).map((option) => option.value)
                          )
                        }
                        className="rounded-lg px-3 py-2 text-sm"
                        style={{ backgroundColor: "var(--card)", color: "var(--text-primary)", border: "1px solid var(--border)", minHeight: "120px" }}
                      >
                        {dependencyOptions.map((task) => (
                          <option key={task.id} value={task.id}>
                            {task.title}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {routingError && (
                    <p className="mt-3 text-sm" style={{ color: "var(--status-blocked)" }}>
                      {routingError}
                    </p>
                  )}
                  <div className="mt-4 flex justify-end gap-2">
                    <button type="button" onClick={resetRoutingDraft} className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                      Cancel routing
                    </button>
                    <button type="button" onClick={handleSaveRouting} disabled={savingRouting || !routingDirty} className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ backgroundColor: "var(--accent)", color: "#111", opacity: savingRouting || !routingDirty ? 0.6 : 1 }}>
                      {savingRouting ? "Saving..." : "Save routing"}
                    </button>
                  </div>
                </section>
              </div>
            ) : (
              <p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>
                Select a task to start planning.
              </p>
            )}
          </div>

          <WorkItemInspector
            kind={selectedTask ? "task" : null}
            itemId={selectedTask?.id || null}
            agentOptions={taskAgents}
            refreshNonce={inspectorRefreshNonce}
            defaultHandoffToAgentId={selectedTask?.handoffToAgentId || ""}
            pendingDecision={taskReviewPending}
            reviewDisabled={!selectedTask || hasDirtyPlanning}
            reviewError={workItemError}
            onReviewSubmit={selectedTask ? handleReviewSubmit : undefined}
            packetActions={
              selectedTask ? (
                <div className="space-y-3">
                  <p className="text-sm" style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
                    Request the latest owner packet from the assigned agent. Save planning changes first so packet context matches the board.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleRequestPacket}
                      disabled={requestingPacket || hasDirtyPlanning || !(selectedTask.assigneeAgentId || selectedTask.agent.id)}
                      className="rounded-lg px-3 py-2 text-sm font-semibold"
                      style={{ backgroundColor: "var(--accent)", color: "#111", opacity: requestingPacket || hasDirtyPlanning || !(selectedTask.assigneeAgentId || selectedTask.agent.id) ? 0.6 : 1 }}
                    >
                      {requestingPacket ? "Requesting..." : "Request owner packet"}
                    </button>
                  </div>
                  {workItemError && (
                    <p className="text-sm" style={{ color: "var(--status-blocked)" }}>
                      {workItemError}
                    </p>
                  )}
                </div>
              ) : null
            }
          />
        </div>
      </div>
    </div>
  );
}
