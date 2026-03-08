"use client";

import { useState, useMemo } from "react";
import { ListTodo, ArrowUpDown } from "lucide-react";
import { TaskRow } from "@/components/TaskRow";
import { taskStatusConfig } from "@/data/mockTasksData";
import type { Task } from "@/data/mockTasksData";
import { useFetch } from "@/lib/useFetch";

type StatusFilter = "all" | "in_progress" | "completed" | "pending" | "blocked";
type SortField = "title" | "status" | "priority" | "dueDate";
type SortDir = "asc" | "desc";

const priorityOrder = { high: 0, medium: 1, low: 2 };

export default function TasksPage() {
  const { data, loading, error, refetch } = useFetch<{ tasks: Task[] }>("/api/agent-tasks");
  const tasks = data?.tasks || [];

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortField, setSortField] = useState<SortField>("dueDate");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    // Filter
    if (statusFilter !== "all") {
      result = result.filter((t) => t.status === statusFilter);
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "title":
          cmp = a.title.localeCompare(b.title);
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
        case "priority":
          cmp = priorityOrder[a.priority] - priorityOrder[b.priority];
          break;
        case "dueDate":
          cmp = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [tasks, statusFilter, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const inProgressCount = tasks.filter((t) => t.status === "in_progress").length;
  const completedCount = tasks.filter((t) => t.status === "completed").length;

  const filterButtons: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "in_progress", label: "In Progress" },
    { key: "completed", label: "Completed" },
    { key: "pending", label: "Pending" },
    { key: "blocked", label: "Blocked" },
  ];

  const columns: { key: SortField | null; label: string; flex: string }[] = [
    { key: "title", label: "Task", flex: "flex-[3]" },
    { key: "status", label: "Status", flex: "flex-[1.2]" },
    { key: "priority", label: "Priority", flex: "flex-[1]" },
    { key: null, label: "Agent", flex: "flex-[1.2]" },
    { key: null, label: "Project", flex: "flex-[1.5]" },
    { key: "dueDate", label: "Due", flex: "flex-[1]" },
    { key: null, label: "", flex: "w-8" },
  ];

  if (loading) {
    return (
      <div className="p-4 md:p-8">
        <div className="flex items-center justify-center h-64">
          <p style={{ color: "var(--text-muted)" }}>Loading tasks...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-8">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p style={{ color: "var(--status-blocked)" }}>Failed to load tasks: {error}</p>
          <button
            onClick={refetch}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
            style={{ backgroundColor: "var(--surface-elevated)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="mb-6">
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
          {tasks.length} total &bull; {inProgressCount} in progress &bull; {completedCount} completed
        </p>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-2 mb-6">
        {filterButtons.map((btn) => {
          const isActive = statusFilter === btn.key;
          const statusColor = btn.key !== "all" ? taskStatusConfig[btn.key]?.color : undefined;
          return (
            <button
              key={btn.key}
              onClick={() => setStatusFilter(btn.key)}
              className="text-xs font-semibold px-3 py-1.5 rounded-full transition-all duration-150"
              style={{
                backgroundColor: isActive
                  ? statusColor
                    ? `color-mix(in srgb, ${statusColor} 20%, transparent)`
                    : "var(--surface-elevated)"
                  : "transparent",
                color: isActive
                  ? statusColor || "var(--text-primary)"
                  : "var(--text-muted)",
                border: isActive
                  ? `1px solid ${statusColor ? `color-mix(in srgb, ${statusColor} 40%, transparent)` : "var(--border-strong)"}`
                  : "1px solid var(--border)",
              }}
            >
              {btn.label}
              {btn.key === "all" && ` (${tasks.length})`}
              {btn.key !== "all" && ` (${tasks.filter((t) => t.status === btn.key).length})`}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--border)",
        }}
      >
        {/* Table Header */}
        <div
          className="flex items-center gap-3 px-4 py-2.5"
          style={{
            borderBottom: "1px solid var(--border)",
            backgroundColor: "var(--surface-elevated)",
          }}
        >
          {columns.map((col, i) => (
            <div
              key={i}
              className={`${col.flex} flex items-center gap-1 ${col.key ? "cursor-pointer select-none" : ""}`}
              onClick={() => col.key && toggleSort(col.key)}
            >
              <span
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: "var(--text-muted)" }}
              >
                {col.label}
              </span>
              {col.key && sortField === col.key && (
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

        {/* Task Rows */}
        {filteredTasks.length > 0 ? (
          filteredTasks.map((task) => (
            <TaskRow key={task.id} task={task} onUpdate={refetch} />
          ))
        ) : (
          <div
            className="p-8 text-center text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            No tasks match the current filter.
          </div>
        )}
      </div>
    </div>
  );
}
