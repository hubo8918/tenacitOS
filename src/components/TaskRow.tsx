"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import type { CSSProperties } from "react";
import { MoreHorizontal } from "lucide-react";
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

interface TaskAgentOption {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

const unassignedAgent: TaskAgentOption = {
  id: "",
  name: "Unassigned",
  emoji: "👤",
  color: "#8E8E93",
};

interface TaskRowProps {
  task: Task;
  agentOptions: TaskAgentOption[];
  onUpdate?: () => void;
}

export function TaskRow({ task, agentOptions, onUpdate }: TaskRowProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [editingDetails, setEditingDetails] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [editingOwnership, setEditingOwnership] = useState(false);
  const [savingOwnership, setSavingOwnership] = useState(false);
  const [ownershipError, setOwnershipError] = useState<string | null>(null);
  const [title, setTitle] = useState(task.title);
  const [project, setProject] = useState(task.project);
  const [dueDate, setDueDate] = useState(task.dueDate);
  const [statusValue, setStatusValue] = useState<Task["status"]>(task.status);
  const [priorityValue, setPriorityValue] = useState<Task["priority"]>(task.priority);
  const [assigneeAgentId, setAssigneeAgentId] = useState("");
  const [reviewerAgentId, setReviewerAgentId] = useState("");
  const [handoffToAgentId, setHandoffToAgentId] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const status = taskStatusConfig[task.status];
  const priority = taskPriorityConfig[task.priority];
  const isOverdue = isTaskOverdue(task.dueDate) && task.status !== "completed";

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
    setProject(task.project);
    setDueDate(task.dueDate);
    setStatusValue(task.status);
    setPriorityValue(task.priority);
    setDetailsError(null);
  }, [task.dueDate, task.priority, task.project, task.status, task.title]);

  useEffect(() => {
    setAssigneeAgentId(inferredAssigneeAgentId);
    setReviewerAgentId(task.reviewerAgentId || "");
    setHandoffToAgentId(task.handoffToAgentId || "");
    setOwnershipError(null);
  }, [inferredAssigneeAgentId, task.reviewerAgentId, task.handoffToAgentId]);

  const resetDetailsDraft = () => {
    setTitle(task.title);
    setProject(task.project);
    setDueDate(task.dueDate);
    setStatusValue(task.status);
    setPriorityValue(task.priority);
    setDetailsError(null);
  };

  const handleStatusChange = async (newStatus: Task["status"]) => {
    setShowMenu(false);
    try {
      await fetch("/api/agent-tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id, status: newStatus }),
      });
      onUpdate?.();
    } catch (err) {
      console.error("Failed to update task:", err);
    }
  };

  const handleDelete = async () => {
    setShowMenu(false);
    try {
      await fetch(`/api/agent-tasks?id=${task.id}`, { method: "DELETE" });
      onUpdate?.();
    } catch (err) {
      console.error("Failed to delete task:", err);
    }
  };

  const handleOpenDetailsEditor = () => {
    setShowMenu(false);
    setEditingOwnership(false);
    resetDetailsDraft();
    setEditingDetails(true);
  };

  const handleSaveDetails = async () => {
    const trimmedTitle = title.trim();
    const trimmedProject = project.trim();

    if (!trimmedTitle) {
      setDetailsError("Title is required.");
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
          project: trimmedProject,
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
    setEditingDetails(false);
    setAssigneeAgentId(inferredAssigneeAgentId);
    setReviewerAgentId(task.reviewerAgentId || "");
    setHandoffToAgentId(task.handoffToAgentId || "");
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
        throw new Error(payload?.error || "Failed to save task routing");
      }

      setEditingOwnership(false);
      onUpdate?.();
    } catch (err) {
      console.error("Failed to update task routing:", err);
      setOwnershipError(err instanceof Error ? err.message : "Failed to save task routing");
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
      style={{
        borderBottom: "1px solid var(--border)",
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
          <span className="text-xs truncate block" style={{ color: "var(--text-muted)" }}>
            {task.project}
          </span>
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
                Edit ownership & handoff
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
                  style={menuItemStyle}
                  onClick={() => handleStatusChange("completed")}
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
                  style={menuItemStyle}
                  onClick={() => handleStatusChange("in_progress")}
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
                style={menuItemStyle}
                onClick={() => handleStatusChange("pending")}
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
                style={{ ...menuItemStyle, color: "#FF453A" }}
                onClick={handleDelete}
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
                  Edit the core board fields here: title, project, due date, status, and priority. Reviewer and handoff stay in the routing editor so this row does not pretend to be a giant everything form.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <label className="flex flex-col gap-1.5 text-xs font-semibold xl:col-span-2" style={{ color: "var(--text-secondary)" }}>
                  Title
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    style={inputStyle}
                    aria-label={`Title for ${task.title}`}
                  />
                </label>

                <label className="flex flex-col gap-1.5 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                  Project
                  <input
                    value={project}
                    onChange={(e) => setProject(e.target.value)}
                    style={inputStyle}
                    aria-label={`Project for ${task.title}`}
                  />
                </label>

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
                    Task ownership & handoff
                  </p>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    Assign an owner, optional reviewer, and optional handoff target. Reviewer and handoff target should stay distinct from the current owner.
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
                  {savingOwnership ? "Saving..." : "Save routing"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
