"use client";

import { useState } from "react";

interface Project {
  id: string;
  title: string;
  description: string;
  status: "active" | "planning" | "paused" | "completed";
  progress: number;
  priority: "high" | "medium" | "low";
  agent: { emoji: string; name: string; color: string };
  updatedAgo: string;
  updatedBy: string;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  active: { label: "Active", color: "#32D74B" },
  planning: { label: "Planning", color: "#0A84FF" },
  paused: { label: "Paused", color: "#FFD60A" },
  completed: { label: "Completed", color: "#8E8E93" },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  high: { label: "high", color: "#FF453A" },
  medium: { label: "medium", color: "#FF9F0A" },
  low: { label: "low", color: "#0A84FF" },
};

const statusOptions: Project["status"][] = ["active", "planning", "paused", "completed"];

interface ProjectCardProps {
  project: Project;
  onUpdate?: () => void;
}

export function ProjectCard({ project, onUpdate }: ProjectCardProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editStatus, setEditStatus] = useState(project.status);
  const [editProgress, setEditProgress] = useState(project.progress);
  const status = statusConfig[project.status];
  const priority = priorityConfig[project.priority];

  async function handleSave() {
    setSaving(true);
    try {
      await fetch("/api/projects", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: project.id,
          status: editStatus,
          progress: editProgress,
          updatedAgo: "just now",
        }),
      });
      onUpdate?.();
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="rounded-xl overflow-hidden transition-all duration-200 hover:scale-[1.02]"
      style={{
        backgroundColor: "var(--card)",
        border: "1px solid var(--border)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--border-strong)";
        e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.3)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div className="p-4 md:p-5">
        {/* Edit overlay */}
        {editing && (
          <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: "var(--surface-elevated)", border: "1px solid var(--border)" }}>
            <div className="mb-3">
              <label className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: "var(--text-muted)" }}>Status</label>
              <div className="flex gap-1.5">
                {statusOptions.map((s) => {
                  const sc = statusConfig[s];
                  const isActive = editStatus === s;
                  return (
                    <button
                      key={s}
                      onClick={() => setEditStatus(s)}
                      className="text-[10px] font-bold px-2 py-1 rounded-full transition-all"
                      style={{
                        backgroundColor: isActive ? `color-mix(in srgb, ${sc.color} 25%, transparent)` : "transparent",
                        color: isActive ? sc.color : "var(--text-muted)",
                        border: `1px solid ${isActive ? sc.color : "var(--border)"}`,
                      }}
                    >
                      {sc.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mb-3">
              <label className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: "var(--text-muted)" }}>
                Progress: {editProgress}%
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={editProgress}
                onChange={(e) => setEditProgress(Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{ accentColor: statusConfig[editStatus].color }}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setEditing(false)}
                className="text-xs px-3 py-1 rounded-lg"
                style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="text-xs px-3 py-1 rounded-lg font-medium"
                style={{ backgroundColor: "#0A84FF", color: "#fff", opacity: saving ? 0.6 : 1 }}
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        )}

        {/* Title + Status Badge */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3
            className="text-base font-bold truncate"
            style={{
              fontFamily: "var(--font-heading)",
              color: "var(--text-primary)",
            }}
          >
            {project.title}
          </h3>
          <span
            className="flex-shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap"
            style={{
              backgroundColor: `color-mix(in srgb, ${status.color} 15%, transparent)`,
              color: status.color,
              border: `1px solid color-mix(in srgb, ${status.color} 30%, transparent)`,
            }}
          >
            {status.label}
          </span>
        </div>

        {/* Description */}
        <p
          className="text-sm mb-4 line-clamp-2"
          style={{ color: "var(--text-secondary)" }}
        >
          {project.description}
        </p>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span
              className="text-xs font-semibold"
              style={{ color: status.color }}
            >
              {project.progress}%
            </span>
          </div>
          <div
            className="h-2 rounded-full overflow-hidden"
            style={{ backgroundColor: "var(--surface-elevated)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${project.progress}%`,
                backgroundColor: status.color,
                boxShadow: project.progress > 0 ? `0 0 8px ${status.color}40` : "none",
              }}
            />
          </div>
        </div>

        {/* Footer: Agent + Updated + Priority */}
        <div className="flex items-center justify-between">
          {/* Agent */}
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs"
              style={{
                backgroundColor: `${project.agent.color}20`,
                border: `1.5px solid ${project.agent.color}40`,
              }}
            >
              {project.agent.emoji}
            </div>
            <span
              className="text-xs font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              {project.agent.name}
            </span>
          </div>

          {/* Updated */}
          <span
            className="text-[10px]"
            style={{ color: "var(--text-muted)" }}
          >
            {project.updatedAgo}
            {project.updatedBy ? ` by ${project.updatedBy}` : ""}
          </span>

          {/* Priority */}
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded"
            style={{
              backgroundColor: `color-mix(in srgb, ${priority.color} 15%, transparent)`,
              color: priority.color,
            }}
          >
            {priority.label}
          </span>
        </div>

        {/* Edit button */}
        {!editing && (
          <button
            onClick={() => { setEditStatus(project.status); setEditProgress(project.progress); setEditing(true); }}
            className="mt-3 w-full text-[10px] font-medium py-1.5 rounded-lg transition-colors"
            style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--surface-hover)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
          >
            Edit Project
          </button>
        )}
      </div>
    </div>
  );
}
