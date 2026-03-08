"use client";

import { useState, useEffect, useRef } from "react";
import { MoreHorizontal } from "lucide-react";

interface Task {
  id: string;
  title: string;
  status: "in_progress" | "completed" | "pending" | "blocked";
  priority: "high" | "medium" | "low";
  agent: { emoji: string; name: string; color: string };
  project: string;
  dueDate: string;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  in_progress: { label: "In Progress", color: "#0A84FF" },
  completed: { label: "Completed", color: "#32D74B" },
  pending: { label: "Pending", color: "#FFD60A" },
  blocked: { label: "Blocked", color: "#FF453A" },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  high: { label: "High", color: "#FF453A" },
  medium: { label: "Medium", color: "#FF9F0A" },
  low: { label: "Low", color: "#0A84FF" },
};

interface TaskRowProps {
  task: Task;
  onUpdate?: () => void;
}

export function TaskRow({ task, onUpdate }: TaskRowProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const status = statusConfig[task.status];
  const priority = priorityConfig[task.priority];
  const isOverdue = new Date(task.dueDate) < new Date() && task.status !== "completed";

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

  const handleStatusChange = async (newStatus: string) => {
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

  const menuItemStyle: React.CSSProperties = {
    padding: "0.375rem 0.75rem",
    fontSize: "0.75rem",
    color: "var(--text-secondary)",
    cursor: "pointer",
    width: "100%",
    textAlign: "left",
    background: "none",
    border: "none",
  };

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 transition-colors duration-150 cursor-pointer"
      style={{
        borderBottom: "1px solid var(--border)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = "var(--surface-hover)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      {/* Task Title */}
      <div className="flex-[3] min-w-0">
        <span
          className="text-sm font-medium truncate block"
          style={{ color: "var(--text-primary)" }}
        >
          {task.title}
        </span>
      </div>

      {/* Status Badge */}
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

      {/* Priority */}
      <div className="flex-[1] flex items-center gap-1.5">
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: priority.color }}
        />
        <span
          className="text-xs"
          style={{ color: priority.color }}
        >
          {priority.label}
        </span>
      </div>

      {/* Agent */}
      <div className="flex-[1.2] flex items-center gap-2">
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] flex-shrink-0"
          style={{
            backgroundColor: `${task.agent.color}20`,
            border: `1.5px solid ${task.agent.color}40`,
          }}
        >
          {task.agent.emoji}
        </div>
        <span
          className="text-xs truncate"
          style={{ color: "var(--text-secondary)" }}
        >
          {task.agent.name}
        </span>
      </div>

      {/* Project */}
      <div className="flex-[1.5] min-w-0">
        <span
          className="text-xs truncate block"
          style={{ color: "var(--text-muted)" }}
        >
          {task.project}
        </span>
      </div>

      {/* Due Date */}
      <div className="flex-[1]">
        <span
          className="text-xs"
          style={{ color: isOverdue ? "#FF453A" : "var(--text-muted)" }}
        >
          {new Date(task.dueDate).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </span>
      </div>

      {/* Actions */}
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
            className="absolute right-0 top-8 z-20 rounded-lg shadow-lg py-1 min-w-[160px]"
            style={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
            }}
          >
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
  );
}
