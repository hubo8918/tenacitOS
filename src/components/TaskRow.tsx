"use client";

import { taskPriorityConfig, taskStatusConfig, type Task } from "@/data/mockTasksData";

interface TaskRowProps {
  rowId?: string;
  task: Task;
  linkedProjectTitle?: string | null;
  hasProjectLink?: boolean | null;
  isSelected?: boolean;
  isTemporarilyHighlighted?: boolean;
  onSelect?: () => void;
}

function formatDueDate(value: string) {
  if (!value) return "No due date";

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function renderAgentName(task: Task, agentId?: string) {
  if (!agentId) {
    return "Unassigned";
  }

  if (task.assigneeAgentId === agentId || task.agent.id === agentId) {
    return task.agent.name;
  }

  return agentId;
}

export function TaskRow({
  rowId,
  task,
  linkedProjectTitle = null,
  hasProjectLink = null,
  isSelected = false,
  isTemporarilyHighlighted = false,
  onSelect,
}: TaskRowProps) {
  const status = taskStatusConfig[task.status];
  const priority = taskPriorityConfig[task.priority];
  const projectLabel = linkedProjectTitle || task.project || "No project";
  const ownerLabel = renderAgentName(task, task.assigneeAgentId || task.agent.id);
  const reviewerLabel = task.reviewerAgentId || "Unassigned";
  const handoffLabel = task.handoffToAgentId || "None";

  return (
    <button
      id={rowId}
      type="button"
      onClick={onSelect}
      className="w-full rounded-xl p-4 text-left transition-colors"
      style={{
        backgroundColor: isSelected ? "color-mix(in srgb, #0A84FF 10%, var(--card))" : "var(--card)",
        border: isTemporarilyHighlighted
          ? "1px solid color-mix(in srgb, #0A84FF 48%, transparent)"
          : isSelected
          ? "1px solid color-mix(in srgb, #0A84FF 34%, transparent)"
          : "1px solid var(--border)",
        boxShadow: isTemporarilyHighlighted ? "0 0 0 2px rgba(10, 132, 255, 0.15)" : "none",
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {task.title}
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>
            {projectLabel}
            {hasProjectLink === false ? " · custom label only" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full px-2 py-1 text-[10px] font-semibold" style={{ color: status.color, backgroundColor: `${status.color}1A` }}>
            {status.label}
          </span>
          <span className="rounded-full px-2 py-1 text-[10px] font-semibold" style={{ color: priority.color, backgroundColor: `${priority.color}1A` }}>
            {priority.label}
          </span>
          <span className="rounded-full px-2 py-1 text-[10px] font-semibold" style={{ color: "#0A84FF", backgroundColor: "color-mix(in srgb, #0A84FF 12%, transparent)" }}>
            {task.runStatus || "idle"}
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Due
          </p>
          <p className="mt-1 text-sm" style={{ color: "var(--text-primary)" }}>
            {formatDueDate(task.dueDate)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Owner
          </p>
          <p className="mt-1 text-sm" style={{ color: "var(--text-primary)" }}>
            {ownerLabel}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Reviewer
          </p>
          <p className="mt-1 text-sm" style={{ color: "var(--text-primary)" }}>
            {reviewerLabel}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Handoff
          </p>
          <p className="mt-1 text-sm" style={{ color: "var(--text-primary)" }}>
            {handoffLabel}
          </p>
        </div>
      </div>

      {task.latestRun?.deliverable && (
        <p className="mt-3 text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
          {task.latestRun.deliverable}
        </p>
      )}
    </button>
  );
}
