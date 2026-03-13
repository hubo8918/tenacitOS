"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import type { CSSProperties } from "react";
import { MoreHorizontal, ExternalLink } from "lucide-react";
import { taskPriorityConfig, taskStatusConfig, type Task } from "@/data/mockTasksData";

function parseLocalDate(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDueDate(dateString: string) {
  return parseLocalDate(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function isTaskOverdue(dateString: string) {
  const dueDate = parseLocalDate(dateString);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return dueDate < startOfToday;
}

function taskDependsOn(taskId: string, targetTaskId: string, dependencyMap: Map<string, string[]>, visited = new Set<string>()): boolean {
  if (taskId === targetTaskId) return true;
  if (visited.has(taskId)) return false;

  visited.add(taskId);
  const blockedByTaskIds = dependencyMap.get(taskId) || [];
  return blockedByTaskIds.some((blockedTaskId) => taskDependsOn(blockedTaskId, targetTaskId, dependencyMap, visited));
}

interface TaskAgentOption {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

interface TaskProjectOption {
  id: string;
  title: string;
}

const unassignedAgent: TaskAgentOption = {
  id: "",
  name: "Unassigned",
  emoji: "👤",
  color: "#8E8E93",
};

const customProjectSentinel = "__custom__";

interface DependencyOption {
  id: string;
  title: string;
  project: string;
  statusLabel: string;
  isSelected: boolean;
  isCycleCandidate: boolean;
  isCompleted: boolean;
  isMissing: boolean;
}

interface TaskRowProps {
  rowId?: string;
  task: Task;
  agentOptions: TaskAgentOption[];
  projectOptions: TaskProjectOption[];
  allTasks: Task[];
  linkedProjectId?: string;
  linkedProjectTitle?: string | null;
  hasProjectLink?: boolean | null;
  isTemporarilyHighlighted?: boolean;
  onUpdate?: () => void;
}

export function TaskRow({
  rowId,
  task,
  agentOptions,
  projectOptions,
  allTasks,
  linkedProjectId,
  linkedProjectTitle = null,
  hasProjectLink = null,
  isTemporarilyHighlighted = false,
  onUpdate,
}: TaskRowProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [editingDetails, setEditingDetails] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [editingOwnership, setEditingOwnership] = useState(false);
  const [savingOwnership, setSavingOwnership] = useState(false);
  const [ownershipError, setOwnershipError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState<"status" | "delete" | null>(null);
  const [pendingStatusLabel, setPendingStatusLabel] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingStatus, setConfirmingStatus] = useState<Task["status"] | null>(null);
  const resolvedProjectLabel = linkedProjectTitle || task.project;
  const [title, setTitle] = useState(task.title);
  const [project, setProject] = useState(resolvedProjectLabel);
  const [selectedProjectLinkMode, setSelectedProjectLinkMode] = useState("");
  const [dueDate, setDueDate] = useState(task.dueDate);
  const [statusValue, setStatusValue] = useState<Task["status"]>(task.status);
  const [priorityValue, setPriorityValue] = useState<Task["priority"]>(task.priority);
  const [assigneeAgentId, setAssigneeAgentId] = useState("");
  const [reviewerAgentId, setReviewerAgentId] = useState("");
  const [handoffToAgentId, setHandoffToAgentId] = useState("");
  const [blockedByDraft, setBlockedByDraft] = useState<string[]>(task.blockedByTaskIds || []);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const resolvedProjectOption = useMemo(
    () => (linkedProjectId ? projectOptions.find((option) => option.id === linkedProjectId) || null : null),
    [linkedProjectId, projectOptions]
  );
  const selectedTrackedProject = useMemo(
    () => projectOptions.find((option) => option.id === selectedProjectLinkMode) || null,
    [projectOptions, selectedProjectLinkMode]
  );

  const status = taskStatusConfig[task.status];
  const priority = taskPriorityConfig[task.priority];
  const isOverdue = isTaskOverdue(task.dueDate) && task.status !== "completed";
  const blockedByTaskIds = useMemo(() => task.blockedByTaskIds || [], [task.blockedByTaskIds]);

  const dependencyMap = useMemo(
    () => new Map(allTasks.map((candidate) => [candidate.id, candidate.blockedByTaskIds || []])),
    [allTasks]
  );

  const cycleCandidateIds = useMemo(() => {
    const nextCycleCandidates = new Set<string>();

    allTasks.forEach((candidate) => {
      if (candidate.id !== task.id && taskDependsOn(candidate.id, task.id, dependencyMap)) {
        nextCycleCandidates.add(candidate.id);
      }
    });

    return nextCycleCandidates;
  }, [allTasks, dependencyMap, task.id]);

  const dependencyOptions = useMemo<DependencyOption[]>(() => {
    const activeOptions = allTasks
      .filter((candidate) => candidate.id !== task.id && candidate.status !== "completed")
      .sort((a, b) => {
        if (a.project === task.project && b.project !== task.project) return -1;
        if (a.project !== task.project && b.project === task.project) return 1;
        return a.title.localeCompare(b.title);
      })
      .map((candidate) => ({
        id: candidate.id,
        title: candidate.title,
        project: candidate.project,
        statusLabel: taskStatusConfig[candidate.status].label,
        isSelected: blockedByDraft.includes(candidate.id),
        isCycleCandidate: cycleCandidateIds.has(candidate.id),
        isCompleted: false,
        isMissing: false,
      }));

    const staleSelectedOptions = blockedByDraft.flatMap<DependencyOption>((taskId) => {
      const candidate = allTasks.find((item) => item.id === taskId);

      if (!candidate) {
        return [{
          id: taskId,
          title: taskId,
          project: "Unavailable task",
          statusLabel: "Missing",
          isSelected: true,
          isCycleCandidate: false,
          isCompleted: false,
          isMissing: true,
        }];
      }

      if (candidate.status !== "completed") {
        return [];
      }

      return [{
        id: candidate.id,
        title: candidate.title,
        project: candidate.project,
        statusLabel: taskStatusConfig[candidate.status].label,
        isSelected: true,
        isCycleCandidate: false,
        isCompleted: true,
        isMissing: false,
      }];
    });

    return [...activeOptions, ...staleSelectedOptions];
  }, [allTasks, blockedByDraft, cycleCandidateIds, task.id, task.project]);

  const staleDependencyOptions = useMemo(
    () => dependencyOptions.filter((candidate) => candidate.isCompleted || candidate.isMissing),
    [dependencyOptions]
  );

  const blockedByDetails = useMemo(
    () =>
      blockedByTaskIds.map((taskId) => {
        const dependency = allTasks.find((candidate) => candidate.id === taskId);

        if (!dependency) {
          return {
            id: taskId,
            title: taskId,
            statusLabel: "Missing",
            isCompleted: false,
            isMissing: true,
          };
        }

        return {
          id: dependency.id,
          title: dependency.title,
          statusLabel: taskStatusConfig[dependency.status].label,
          isCompleted: dependency.status === "completed",
          isMissing: false,
        };
      }),
    [allTasks, blockedByTaskIds]
  );

  const blockedByLabels = useMemo(() => blockedByDetails.map((dependency) => dependency.title), [blockedByDetails]);
  const staleBlockedByDetails = useMemo(
    () => blockedByDetails.filter((dependency) => dependency.isCompleted || dependency.isMissing),
    [blockedByDetails]
  );
  const missingBlockedByCount = staleBlockedByDetails.filter((dependency) => dependency.isMissing).length;
  const completedBlockedByCount = staleBlockedByDetails.filter((dependency) => dependency.isCompleted).length;
  const dependencyPreview = blockedByLabels.slice(0, 2).join(", ");
  const dependencyTitle = blockedByDetails
    .map((dependency) => {
      if (dependency.isMissing) {
        return `${dependency.title} (missing)`;
      }

      if (dependency.isCompleted) {
        return `${dependency.title} (${dependency.statusLabel.toLowerCase()})`;
      }

      return dependency.title;
    })
    .join(", ");
  const staleBlockerSummary = [
    missingBlockedByCount > 0 ? `${missingBlockedByCount} missing` : null,
    completedBlockedByCount > 0 ? `${completedBlockedByCount} completed` : null,
  ]
    .filter(Boolean)
    .join(" • ");
  const staleBlockerTitle = staleBlockedByDetails
    .map((dependency) =>
      dependency.isMissing
        ? `${dependency.title} is missing from the board`
        : `${dependency.title} is already completed`
    )
    .join("; ");
  const blockerSummaryColor = missingBlockedByCount > 0
    ? "var(--status-blocked)"
    : completedBlockedByCount > 0
      ? "#FF9F0A"
      : status.color;

  const inferredAssigneeAgentId = useMemo(() => {
    if (task.assigneeAgentId) return task.assigneeAgentId;
    if (task.agent.id) return task.agent.id;
    return agentOptions.find((option) => option.name.toLowerCase() === task.agent.name.toLowerCase())?.id || "";
  }, [agentOptions, task.agent.id, task.agent.name, task.assigneeAgentId]);

  const assigneeOption = useMemo(
    () => agentOptions.find((option) => option.id === inferredAssigneeAgentId),
    [agentOptions, inferredAssigneeAgentId]
  );
  const reviewerOption = useMemo(
    () => agentOptions.find((option) => option.id === task.reviewerAgentId),
    [agentOptions, task.reviewerAgentId]
  );
  const handoffOption = useMemo(
    () => agentOptions.find((option) => option.id === task.handoffToAgentId),
    [agentOptions, task.handoffToAgentId]
  );

  const displayOwner = assigneeOption || (task.agent.name === "Unassigned" ? unassignedAgent : {
    id: task.agent.id || "",
    emoji: task.agent.emoji,
    name: task.agent.name,
    color: task.agent.color,
  });
  const projectFocusHref = linkedProjectId
    ? `/agents/projects?project=${encodeURIComponent(linkedProjectTitle || task.project)}&projectId=${encodeURIComponent(linkedProjectId)}&task=${encodeURIComponent(task.id)}`
    : task.project.trim()
      ? `/agents/projects?project=${encodeURIComponent(task.project.trim())}&task=${encodeURIComponent(task.id)}`
      : `/agents/projects?task=${encodeURIComponent(task.id)}`;
  const projectLabelMismatch = hasProjectLink === false;

  useEffect(() => {
    if (!showMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setShowMenu(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [showMenu]);

  useEffect(() => {
    setTitle(task.title);
    setProject(resolvedProjectOption?.title || task.project);
    setSelectedProjectLinkMode(
      resolvedProjectOption
        ? resolvedProjectOption.id
        : task.project.trim()
          ? customProjectSentinel
          : ""
    );
    setDueDate(task.dueDate);
    setStatusValue(task.status);
    setPriorityValue(task.priority);
    setDetailsError(null);
  }, [resolvedProjectOption, task.dueDate, task.priority, task.project, task.status, task.title]);

  useEffect(() => {
    setAssigneeAgentId(inferredAssigneeAgentId);
    setReviewerAgentId(task.reviewerAgentId || "");
    setHandoffToAgentId(task.handoffToAgentId || "");
    setBlockedByDraft(task.blockedByTaskIds || []);
    setOwnershipError(null);
  }, [inferredAssigneeAgentId, task.blockedByTaskIds, task.reviewerAgentId, task.handoffToAgentId]);

  useEffect(() => {
    setActionError(null);
    setActionPending(null);
    setPendingStatusLabel(null);
    setConfirmingDelete(false);
    setConfirmingStatus(null);
  }, [resolvedProjectLabel, task.id, task.status, task.title, task.dueDate, task.priority]);

  const resetDetailsDraft = () => {
    setTitle(task.title);
    setProject(resolvedProjectOption?.title || task.project);
    setSelectedProjectLinkMode(
      resolvedProjectOption
        ? resolvedProjectOption.id
        : task.project.trim()
          ? customProjectSentinel
          : ""
    );
    setDueDate(task.dueDate);
    setStatusValue(task.status);
    setPriorityValue(task.priority);
    setDetailsError(null);
  };

  const handleStatusChange = async (newStatus: Task["status"]) => {
    if (actionPending) return;

    const newStatusLabel = taskStatusConfig[newStatus].label;
    setShowMenu(false);
    setConfirmingDelete(false);
    setConfirmingStatus(newStatus);
    setActionError(null);
    setPendingStatusLabel(newStatusLabel);
  };

  const confirmStatusChange = async (newStatus: Task["status"]) => {
    if (actionPending) return;

    setConfirmingStatus(null);
    setActionError(null);
    setActionPending("status");
    setPendingStatusLabel(taskStatusConfig[newStatus].label);

    try {
      const response = await fetch("/api/agent-tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id, status: newStatus }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to update task status");
      }

      onUpdate?.();
    } catch (err) {
      console.error("Failed to update task:", err);
      setActionError(err instanceof Error ? err.message : "Failed to update task status");
    } finally {
      setActionPending(null);
      setPendingStatusLabel(null);
    }
  };

  const handleRequestDelete = () => {
    setShowMenu(false);
    setEditingDetails(false);
    setEditingOwnership(false);
    setConfirmingStatus(null);
    setActionError(null);
    setConfirmingDelete(true);
  };

  const handleDelete = async () => {
    if (actionPending) return;

    setActionError(null);
    setActionPending("delete");

    try {
      const response = await fetch(`/api/agent-tasks?id=${task.id}`, { method: "DELETE" });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to delete task");
      }

      setConfirmingDelete(false);
      onUpdate?.();
    } catch (err) {
      console.error("Failed to delete task:", err);
      setActionError(err instanceof Error ? err.message : "Failed to delete task");
    } finally {
      setActionPending(null);
    }
  };

  const handleOpenDetailsEditor = () => {
    setShowMenu(false);
    setConfirmingDelete(false);
    setConfirmingStatus(null);
    setEditingOwnership(false);
    resetDetailsDraft();
    setEditingDetails(true);
  };

  const handleSaveDetails = async () => {
    const trimmedTitle = title.trim();
    const trimmedProject = project.trim();
    const nextTrackedProject = selectedTrackedProject;
    const nextProjectLabel = nextTrackedProject
      ? nextTrackedProject.title
      : selectedProjectLinkMode === customProjectSentinel
        ? trimmedProject
        : "";
    const nextProjectId = nextTrackedProject ? nextTrackedProject.id : null;

    if (!trimmedTitle) {
      setDetailsError("Title is required.");
      return;
    }

    if (selectedProjectLinkMode === customProjectSentinel && !trimmedProject) {
      setDetailsError("Custom project label is required, or switch this task to No project.");
      return;
    }

    if (!dueDate) {
      setDetailsError("Due date is required.");
      return;
    }

    setSavingDetails(true);
    setDetailsError(null);

    try {
      const response = await fetch("/api/agent-tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: task.id,
          title: trimmedTitle,
          project: nextProjectLabel,
          projectId: nextProjectId,
          dueDate,
          status: statusValue,
          priority: priorityValue,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to save task details");
      }

      setEditingDetails(false);
      onUpdate?.();
    } catch (err) {
      console.error("Failed to update task details:", err);
      setDetailsError(err instanceof Error ? err.message : "Failed to save task details");
    } finally {
      setSavingDetails(false);
    }
  };

  const handleOpenOwnershipEditor = () => {
    setShowMenu(false);
    setConfirmingDelete(false);
    setConfirmingStatus(null);
    setEditingDetails(false);
    setAssigneeAgentId(inferredAssigneeAgentId);
    setReviewerAgentId(task.reviewerAgentId || "");
    setHandoffToAgentId(task.handoffToAgentId || "");
    setBlockedByDraft(task.blockedByTaskIds || []);
    setOwnershipError(null);
    setEditingOwnership(true);
  };

  const handleSaveOwnership = async () => {
    if (assigneeAgentId && reviewerAgentId && assigneeAgentId === reviewerAgentId) {
      setOwnershipError("Reviewer must be different from the owner.");
      return;
    }

    if (assigneeAgentId && handoffToAgentId && assigneeAgentId === handoffToAgentId) {
      setOwnershipError("Handoff target must be different from the owner.");
      return;
    }

    if (blockedByDraft.includes(task.id)) {
      setOwnershipError("A task cannot depend on itself.");
      return;
    }

    const missingBlocker = staleDependencyOptions.find((candidate) => candidate.isMissing);
    if (missingBlocker) {
      setOwnershipError(`Remove stale blocker \"${missingBlocker.title}\" before saving. It is no longer available on the Tasks board.`);
      return;
    }

    const completedBlocker = staleDependencyOptions.find((candidate) => candidate.isCompleted);
    if (completedBlocker) {
      setOwnershipError(`Remove completed blocker \"${completedBlocker.title}\" before saving. Finished work should not stay listed as an active blocker.`);
      return;
    }

    const cycleTask = blockedByDraft.find((taskId) => cycleCandidateIds.has(taskId));
    if (cycleTask) {
      const cycleTaskTitle = allTasks.find((candidate) => candidate.id === cycleTask)?.title || cycleTask;
      setOwnershipError(`Cannot save blocker \"${cycleTaskTitle}\" because it already depends on this task.`);
      return;
    }

    setSavingOwnership(true);
    setOwnershipError(null);

    try {
      const nextOwner = agentOptions.find((option) => option.id === assigneeAgentId);
      const response = await fetch("/api/agent-tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: task.id,
          assigneeAgentId: assigneeAgentId || undefined,
          reviewerAgentId: reviewerAgentId || undefined,
          handoffToAgentId: handoffToAgentId || undefined,
          blockedByTaskIds: blockedByDraft,
          agent: nextOwner
            ? {
                id: nextOwner.id,
                emoji: nextOwner.emoji,
                name: nextOwner.name,
                color: nextOwner.color,
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
        throw new Error(payload?.error || "Failed to save task routing and blockers");
      }

      setEditingOwnership(false);
      onUpdate?.();
    } catch (err) {
      console.error("Failed to update task routing and blockers:", err);
      setOwnershipError(err instanceof Error ? err.message : "Failed to save task routing and blockers");
    } finally {
      setSavingOwnership(false);
    }
  };

  const menuItemStyle: CSSProperties = {
    padding: "0.375rem 0.75rem",
    fontSize: "0.75rem",
    color: "var(--text-secondary)",
    cursor: "pointer",
    width: "100%",
    textAlign: "left",
    background: "none",
    border: "none",
  };

  const inputStyle: CSSProperties = {
    width: "100%",
    padding: "0.55rem 0.7rem",
    borderRadius: "0.6rem",
    border: "1px solid var(--border)",
    backgroundColor: "var(--card)",
    color: "var(--text-primary)",
    fontSize: "0.85rem",
    outline: "none",
  };

  return (
    <div
      id={rowId}
      style={{
        borderBottom: "1px solid var(--border)",
        backgroundColor: isTemporarilyHighlighted ? "color-mix(in srgb, #FFD60A 12%, transparent)" : "transparent",
        boxShadow: isTemporarilyHighlighted ? "inset 3px 0 0 #FFD60A" : "none",
        transition: "background-color 220ms ease, box-shadow 220ms ease",
      }}
    >
      <div
        className="flex items-center gap-3 px-4 py-3 transition-colors duration-150 cursor-pointer"
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "var(--surface-hover)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "transparent";
        }}
      >
        <div className="flex-[3] min-w-0">
          <span className="text-sm font-medium truncate block" style={{ color: "var(--text-primary)" }}>
            {task.title}
          </span>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
            <span>
              Review:{" "}
              <span style={{ color: reviewerOption?.color || "var(--text-secondary)", fontWeight: 600 }}>
                {reviewerOption ? `${reviewerOption.emoji} ${reviewerOption.name}` : "Not set"}
              </span>
            </span>
            <span>
              Handoff:{" "}
              <span style={{ color: handoffOption?.color || "var(--text-secondary)", fontWeight: 600 }}>
                {handoffOption ? `${handoffOption.emoji} ${handoffOption.name}` : "Not set"}
              </span>
            </span>
            {blockedByTaskIds.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open("/agents/tasks", "_blank");
                  }}
                  className="inline-flex items-center gap-1 hover:underline transition-colors"
                  style={{ color: "var(--text-muted)" }}
                  title={`Blocked by ${dependencyTitle}`}
                >
                  <span>
                    Blocked by:{" "}
                    <span style={{ color: blockerSummaryColor, fontWeight: 600 }}>
                      {dependencyPreview}
                      {blockedByTaskIds.length > 2 ? ` +${blockedByTaskIds.length - 2}` : ""}
                    </span>
                  </span>
                  <ExternalLink className="w-3 h-3 opacity-60 flex-shrink-0" />
                </button>

                {staleBlockedByDetails.length > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenOwnershipEditor();
                    }}
                    className="inline-flex items-center rounded-full px-2 py-0.5 transition-colors"
                    style={{
                      color: blockerSummaryColor,
                      backgroundColor: `color-mix(in srgb, ${blockerSummaryColor} 10%, transparent)`,
                      border: `1px solid color-mix(in srgb, ${blockerSummaryColor} 28%, transparent)`,
                    }}
                    title={staleBlockerTitle}
                  >
                    Cleanup blockers: {staleBlockerSummary}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex-[1.2]">
          <span
            className="text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap"
            style={{
              backgroundColor: `color-mix(in srgb, ${status.color} 15%, transparent)`,
              color: status.color,
              border: `1px solid color-mix(in srgb, ${status.color} 30%, transparent)`,
            }}
          >
            {status.label}
          </span>
        </div>

        <div className="flex-[1] flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: priority.color }} />
          <span className="text-xs" style={{ color: priority.color }}>
            {priority.label}
          </span>
        </div>

        <div className="flex-[1.2] flex items-center gap-2">
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] flex-shrink-0"
            style={{
              backgroundColor: `${displayOwner.color}20`,
              border: `1.5px solid ${displayOwner.color}40`,
            }}
          >
            {displayOwner.emoji}
          </div>
          <span className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>
            {displayOwner.name}
          </span>
        </div>

        <div className="flex-[1.5] min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                window.open(projectFocusHref, "_blank");
              }}
              className="text-xs truncate block text-left hover:underline hover:text-[var(--text-secondary)] transition-colors flex items-center gap-1.5 max-w-full"
              style={{ color: projectLabelMismatch ? "#FF9F0A" : "var(--text-muted)" }}
              title={projectLabelMismatch
                ? `No live Projects record currently resolves from \"${task.project}\". Opening Projects will show the mismatch state for this task.`
                : `Open linked project in Projects: ${resolvedProjectLabel || task.project}`}
            >
              <span className="truncate">{resolvedProjectLabel || "No project"}</span>
              <ExternalLink className="w-3 h-3 opacity-60 flex-shrink-0" />
            </button>
            {projectLabelMismatch && (
              <>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={{
                    color: "#FF9F0A",
                    backgroundColor: "color-mix(in srgb, #FF9F0A 14%, transparent)",
                    border: "1px solid color-mix(in srgb, #FF9F0A 28%, transparent)",
                  }}
                  title="This task does not currently resolve to a live project on the Projects board."
                >
                  Link missing
                </span>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleOpenDetailsEditor();
                  }}
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors"
                  style={{
                    color: "#FF9F0A",
                    backgroundColor: "transparent",
                    border: "1px solid color-mix(in srgb, #FF9F0A 30%, transparent)",
                  }}
                  title={`Edit this task's project field for ${task.title}`}
                >
                  Fix project
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex-[1]">
          <span className="text-xs" style={{ color: isOverdue ? "#FF453A" : "var(--text-muted)" }}>
            {formatDueDate(task.dueDate)}
          </span>
        </div>

        <div className="w-8 flex justify-center relative">
          <button
            ref={buttonRef}
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu((v) => !v);
            }}
            className="p-1 rounded transition-colors"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--text-secondary)";
              e.currentTarget.style.backgroundColor = "var(--surface-elevated)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--text-muted)";
              e.currentTarget.style.backgroundColor = "transparent";
            }}
            aria-label="Task actions"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {showMenu && (
            <div
              ref={menuRef}
              className="absolute right-0 top-8 z-20 rounded-lg shadow-lg py-1 min-w-[180px]"
              style={{
                backgroundColor: "var(--card)",
                border: "1px solid var(--border)",
              }}
            >
              <button
                style={menuItemStyle}
                onClick={handleOpenDetailsEditor}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--surface-hover)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                Edit task details
              </button>
              <button
                style={menuItemStyle}
                onClick={handleOpenOwnershipEditor}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--surface-hover)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                Edit routing & dependencies
              </button>
              <div
                style={{
                  height: "1px",
                  backgroundColor: "var(--border)",
                  margin: "0.25rem 0",
                }}
              />
              {task.status !== "completed" && (
                <button
                  style={{ ...menuItemStyle, opacity: actionPending ? 0.6 : 1 }}
                  onClick={() => handleStatusChange("completed")}
                  disabled={Boolean(actionPending)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--surface-hover)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  Mark Complete
                </button>
              )}
              {task.status !== "in_progress" && (
                <button
                  style={{ ...menuItemStyle, opacity: actionPending ? 0.6 : 1 }}
                  onClick={() => handleStatusChange("in_progress")}
                  disabled={Boolean(actionPending)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--surface-hover)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  Mark In Progress
                </button>
              )}
              <button
                style={{ ...menuItemStyle, opacity: actionPending ? 0.6 : 1 }}
                onClick={() => handleStatusChange("pending")}
                disabled={Boolean(actionPending)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--surface-hover)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                Mark Pending
              </button>
              <div
                style={{
                  height: "1px",
                  backgroundColor: "var(--border)",
                  margin: "0.25rem 0",
                }}
              />
              <button
                style={{ ...menuItemStyle, color: "#FF453A", opacity: actionPending ? 0.6 : 1 }}
                onClick={handleRequestDelete}
                disabled={Boolean(actionPending)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--surface-hover)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {(confirmingDelete || confirmingStatus || actionError || actionPending) && (
        <div className="px-4 pb-3">
          <div
            className="rounded-xl p-3 md:p-4"
            style={{
              backgroundColor: "var(--surface-elevated)",
              border: "1px solid var(--border)",
            }}
          >
            <div className="flex flex-col gap-3">
              {confirmingDelete && (
                <>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      Delete this task?
                    </p>
                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
                      This removes the task from the coordination board. Mission Control does not yet have an undo flow for deletes, so confirm before removing it.
                    </p>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setConfirmingDelete(false);
                        setActionError(null);
                      }}
                      disabled={actionPending === "delete"}
                      className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                      style={{
                        color: "var(--text-secondary)",
                        border: "1px solid var(--border)",
                        opacity: actionPending === "delete" ? 0.6 : 1,
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={actionPending === "delete"}
                      className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                      style={{
                        backgroundColor: "#FF453A",
                        color: "#fff",
                        opacity: actionPending === "delete" ? 0.6 : 1,
                      }}
                    >
                      {actionPending === "delete" ? "Deleting..." : "Confirm delete"}
                    </button>
                  </div>
                </>
              )}

              {confirmingStatus && (
                <>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      Change task status to {pendingStatusLabel || taskStatusConfig[confirmingStatus].label}?
                    </p>
                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
                      This marks the task as {(pendingStatusLabel || taskStatusConfig[confirmingStatus].label).toLowerCase()}. The task ownership and handoff metadata remain unchanged.
                    </p>
                  </div>
                  {blockedByTaskIds.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
                        Dependencies
                      </p>
                      <p className="text-[11px] mb-2" style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
                        This task is currently blocked by {blockedByTaskIds.length} task{blockedByTaskIds.length > 1 ? "s" : ""}: {blockedByLabels.join(", ")}.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setShowMenu(false);
                          setConfirmingStatus(null);
                          window.open("/agents/tasks", "_blank");
                        }}
                        className="text-[11px] font-medium px-3 py-1.5 rounded-lg transition-colors"
                        style={{
                          color: "var(--text-secondary)",
                          border: "1px solid var(--border)",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "var(--surface-hover)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "transparent";
                        }}
                      >
                        Open Tasks board
                      </button>
                    </div>
                  )}
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setConfirmingStatus(null);
                        setActionError(null);
                      }}
                      disabled={actionPending === "status"}
                      className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                      style={{
                        color: "var(--text-secondary)",
                        border: "1px solid var(--border)",
                        opacity: actionPending === "status" ? 0.6 : 1,
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => confirmStatusChange(confirmingStatus)}
                      disabled={actionPending === "status"}
                      className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                      style={{
                        backgroundColor: "var(--accent)",
                        color: "#000",
                        opacity: actionPending === "status" ? 0.6 : 1,
                      }}
                    >
                      {actionPending === "status" ? "Updating..." : "Confirm change"}
                    </button>
                  </div>
                </>
              )}

              {actionPending === "status" && (
                <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  Updating status to {pendingStatusLabel || "the selected state"}...
                </p>
              )}

              {actionError && (
                <p className="text-xs font-medium" style={{ color: "var(--status-blocked)" }}>
                  {actionError}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {editingDetails && (
        <div className="px-4 pb-3">
          <div
            className="rounded-xl p-3 md:p-4"
            style={{
              backgroundColor: "var(--surface-elevated)",
              border: "1px solid var(--border)",
            }}
          >
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  Task details
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  Edit the core board fields here: title, project linkage, due date, status, and priority. Reviewer and handoff stay in the routing editor so this row does not pretend to be a giant everything form.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <label className="flex flex-col gap-1.5 text-xs font-semibold xl:col-span-2" style={{ color: "var(--text-secondary)" }}>
                  Title
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    style={inputStyle}
                    aria-label={`Title for ${task.title}`}
                  />
                </label>

                <div className="flex flex-col gap-1.5 text-xs font-semibold xl:col-span-2" style={{ color: "var(--text-secondary)" }}>
                  <label className="flex flex-col gap-1.5">
                    Project linkage
                    <select
                      value={selectedProjectLinkMode}
                      onChange={(e) => {
                        const nextValue = e.target.value;
                        setSelectedProjectLinkMode(nextValue);
                        setDetailsError(null);

                        if (nextValue === customProjectSentinel) {
                          setProject((current) => current || task.project || linkedProjectTitle || "");
                          return;
                        }

                        const nextProject = projectOptions.find((option) => option.id === nextValue);
                        setProject(nextProject?.title || "");
                      }}
                      style={inputStyle}
                      aria-label={`Project linkage for ${task.title}`}
                    >
                      <option value="">No project</option>
                      <option value={customProjectSentinel}>Custom label / unresolved link</option>
                      {projectOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.title}
                        </option>
                      ))}
                    </select>
                  </label>

                  {selectedProjectLinkMode === customProjectSentinel ? (
                    <>
                      <label className="flex flex-col gap-1.5">
                        Project label
                        <input
                          value={project}
                          onChange={(e) => setProject(e.target.value)}
                          style={inputStyle}
                          aria-label={`Custom project label for ${task.title}`}
                        />
                      </label>
                      <p style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>
                        This keeps the saved label editable, but it will stay outside the live Projects linkage model until it matches or you relink it to a tracked project here.
                      </p>
                    </>
                  ) : selectedTrackedProject ? (
                    <p style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>
                      This task will stay linked to <span style={{ color: "var(--text-primary)" }}>{selectedTrackedProject.title}</span> through its stable project id instead of relying only on a free-typed title.
                    </p>
                  ) : (
                    <p style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>
                      No project link will be saved for this task.
                    </p>
                  )}
                </div>

                <label className="flex flex-col gap-1.5 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                  Due date
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    style={inputStyle}
                    aria-label={`Due date for ${task.title}`}
                  />
                </label>

                <label className="flex flex-col gap-1.5 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                  Status
                  <select
                    value={statusValue}
                    onChange={(e) => setStatusValue(e.target.value as Task["status"])}
                    style={inputStyle}
                    aria-label={`Status for ${task.title}`}
                  >
                    {Object.entries(taskStatusConfig).map(([value, config]) => (
                      <option key={value} value={value}>
                        {config.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1.5 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                  Priority
                  <select
                    value={priorityValue}
                    onChange={(e) => setPriorityValue(e.target.value as Task["priority"])}
                    style={inputStyle}
                    aria-label={`Priority for ${task.title}`}
                  >
                    {Object.entries(taskPriorityConfig).map(([value, config]) => (
                      <option key={value} value={value}>
                        {config.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {detailsError && (
                <p className="text-xs font-medium" style={{ color: "var(--status-blocked)" }}>
                  {detailsError}
                </p>
              )}

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    resetDetailsDraft();
                    setEditingDetails(false);
                  }}
                  className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                  style={{
                    color: "var(--text-secondary)",
                    border: "1px solid var(--border)",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveDetails}
                  disabled={savingDetails}
                  className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                  style={{
                    backgroundColor: "var(--accent)",
                    color: "#000",
                    opacity: savingDetails ? 0.6 : 1,
                  }}
                >
                  {savingDetails ? "Saving..." : "Save details"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingOwnership && (
        <div className="px-4 pb-3">
          <div
            className="rounded-xl p-3 md:p-4"
            style={{
              backgroundColor: "var(--surface-elevated)",
              border: "1px solid var(--border)",
            }}
          >
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    Task routing & dependencies
                  </p>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
                    Assign an owner, optional reviewer, optional handoff target, and any blocking tasks. Reviewer and handoff target should stay distinct from the current owner.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <label className="flex flex-col gap-1.5 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                  Owner
                  <select
                    value={assigneeAgentId}
                    onChange={(e) => setAssigneeAgentId(e.target.value)}
                    style={inputStyle}
                    aria-label={`Owner for ${task.title}`}
                  >
                    <option value="">Unassigned</option>
                    {agentOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1.5 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                  Reviewer
                  <select
                    value={reviewerAgentId}
                    onChange={(e) => setReviewerAgentId(e.target.value)}
                    style={inputStyle}
                    aria-label={`Reviewer for ${task.title}`}
                  >
                    <option value="">No reviewer</option>
                    {agentOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1.5 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                  Handoff target
                  <select
                    value={handoffToAgentId}
                    onChange={(e) => setHandoffToAgentId(e.target.value)}
                    style={inputStyle}
                    aria-label={`Handoff target for ${task.title}`}
                  >
                    <option value="">No handoff planned</option>
                    {agentOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="rounded-xl p-3" style={{ border: "1px solid var(--border)", backgroundColor: "var(--card)" }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                      Blocking tasks
                    </p>
                    <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
                      Pick the unfinished tasks that still need to land before this one can move. Same-project tasks are listed first, cycle-causing tasks stay disabled, and completed or missing blockers stay visible only when you need to clean them up.
                    </p>
                  </div>
                  <span className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
                    {blockedByDraft.length} selected
                  </span>
                </div>

                {staleDependencyOptions.length > 0 && (
                  <div
                    className="mt-3 rounded-lg px-3 py-2"
                    style={{
                      border: "1px solid color-mix(in srgb, #FF9F0A 35%, transparent)",
                      backgroundColor: "color-mix(in srgb, #FF9F0A 10%, transparent)",
                    }}
                  >
                    <p className="text-[11px] font-semibold" style={{ color: "#FF9F0A" }}>
                      Cleanup needed before save
                    </p>
                    <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
                      Completed or missing blockers are shown below only so you can remove them honestly. Mission Control will not save them as active blockers.
                    </p>
                  </div>
                )}

                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {dependencyOptions.length > 0 ? (
                    dependencyOptions.map((candidate) => {
                      const disableSelection = candidate.isCycleCandidate && !candidate.isSelected;
                      const borderColor = candidate.isMissing
                        ? "color-mix(in srgb, var(--status-blocked) 35%, transparent)"
                        : candidate.isCompleted
                          ? "color-mix(in srgb, #FF9F0A 35%, transparent)"
                          : "var(--border)";
                      const backgroundColor = candidate.isSelected
                        ? "var(--surface-hover)"
                        : candidate.isMissing
                          ? "color-mix(in srgb, var(--status-blocked) 8%, transparent)"
                          : candidate.isCompleted
                            ? "color-mix(in srgb, #FF9F0A 8%, transparent)"
                            : "transparent";

                      return (
                        <label
                          key={candidate.id}
                          className="flex items-start gap-2 rounded-lg px-3 py-2"
                          style={{
                            border: `1px solid ${borderColor}`,
                            backgroundColor,
                            cursor: disableSelection ? "not-allowed" : "pointer",
                            opacity: disableSelection ? 0.65 : 1,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={candidate.isSelected}
                            disabled={disableSelection}
                            onChange={(event) => {
                              setBlockedByDraft((current) =>
                                event.target.checked
                                  ? [...current, candidate.id]
                                  : current.filter((taskId) => taskId !== candidate.id)
                              );
                            }}
                          />
                          <span className="min-w-0">
                            <span className="block text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                              {candidate.title}
                            </span>
                            <span className="block text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
                              {candidate.project} • {candidate.statusLabel}
                            </span>
                            {candidate.isMissing && (
                              <span className="block text-[11px] mt-1" style={{ color: "var(--status-blocked)" }}>
                                This blocker no longer exists in the current task list. Remove it before saving.
                              </span>
                            )}
                            {candidate.isCompleted && (
                              <span className="block text-[11px] mt-1" style={{ color: "#FF9F0A" }}>
                                This blocker is already completed. Remove it if this task is no longer actively blocked.
                              </span>
                            )}
                            {candidate.isCycleCandidate && (
                              <span className="block text-[11px] mt-1" style={{ color: "var(--status-blocked)" }}>
                                Would create a dependency cycle with this task
                              </span>
                            )}
                          </span>
                        </label>
                      );
                    })
                  ) : (
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      No other tasks are available to use as blockers yet.
                    </p>
                  )}
                </div>
              </div>

              {ownershipError && (
                <p className="text-xs font-medium" style={{ color: "var(--status-blocked)" }}>
                  {ownershipError}
                </p>
              )}

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setEditingOwnership(false);
                    setOwnershipError(null);
                    setAssigneeAgentId(inferredAssigneeAgentId);
                    setReviewerAgentId(task.reviewerAgentId || "");
                    setHandoffToAgentId(task.handoffToAgentId || "");
                    setBlockedByDraft(task.blockedByTaskIds || []);
                  }}
                  className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                  style={{
                    color: "var(--text-secondary)",
                    border: "1px solid var(--border)",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveOwnership}
                  disabled={savingOwnership}
                  className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                  style={{
                    backgroundColor: displayOwner.color,
                    color: "#fff",
                    opacity: savingOwnership ? 0.6 : 1,
                  }}
                >
                  {savingOwnership ? "Saving..." : "Save routing & blockers"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
