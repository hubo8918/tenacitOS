"use client";

import { useMemo, useState } from "react";
import { priorityConfig, statusConfig, type Project, type ProjectPhase } from "@/data/mockProjectsData";
import type { TeamAgent } from "@/data/mockTeamData";

const phaseStatusConfig: Record<ProjectPhase["status"], { label: string; color: string }> = {
  pending: { label: "Pending", color: "#FFD60A" },
  in_progress: { label: "In Progress", color: "#0A84FF" },
  blocked: { label: "Blocked", color: "#FF453A" },
  completed: { label: "Completed", color: "#8E8E93" },
};

const projectStatusOptions: Project["status"][] = ["active", "planning", "paused", "completed"];
const phaseStatusOptions: ProjectPhase["status"][] = ["pending", "in_progress", "blocked", "completed"];

const unassignedAgent = { emoji: "👤", name: "Unassigned", color: "#8E8E93" };

function getCurrentPhase(project: Project): ProjectPhase | null {
  return (
    project.phases.find((phase) => phase.status === "in_progress") ||
    project.phases.find((phase) => phase.status === "blocked") ||
    project.phases.find((phase) => phase.status === "pending") ||
    project.phases[0] ||
    null
  );
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

interface ProjectCardProps {
  project: Project;
  teamAgents: TeamAgent[];
  onUpdate?: () => void;
}

export function ProjectCard({ project, teamAgents, onUpdate }: ProjectCardProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState(project.status);
  const [editProgress, setEditProgress] = useState(project.progress);
  const [editOwnerAgentId, setEditOwnerAgentId] = useState(project.ownerAgentId || "");
  const currentPhase = useMemo(() => getCurrentPhase(project), [project]);
  const [editPhaseTitle, setEditPhaseTitle] = useState(currentPhase?.title || "");
  const [editPhaseStatus, setEditPhaseStatus] = useState<ProjectPhase["status"]>(currentPhase?.status || "pending");

  const status = statusConfig[project.status];
  const priority = priorityConfig[project.priority];
  const currentPhaseStatus = currentPhase ? phaseStatusConfig[currentPhase.status] : null;
  const owner = useMemo(() => teamAgents.find((agent) => agent.id === project.ownerAgentId) || null, [teamAgents, project.ownerAgentId]);
  const displayOwner = owner
    ? { emoji: owner.emoji, name: owner.name, color: owner.color }
    : project.ownerAgentId
      ? project.agent
      : unassignedAgent;

  const participatingAgents = useMemo(
    () =>
      teamAgents.filter((agent) => project.participatingAgentIds.includes(agent.id)).slice(0, 3),
    [teamAgents, project.participatingAgentIds]
  );
  const participatingCount = project.participatingAgentIds.length;

  const resetDraft = () => {
    const nextPhase = getCurrentPhase(project);
    setEditStatus(project.status);
    setEditProgress(project.progress);
    setEditOwnerAgentId(project.ownerAgentId || "");
    setEditPhaseTitle(nextPhase?.title || "");
    setEditPhaseStatus(nextPhase?.status || "pending");
    setSaveError(null);
  };

  async function handleSave() {
    if (saving) return;

    setSaving(true);
    setSaveError(null);

    const trimmedPhaseTitle = editPhaseTitle.trim();
    const selectedOwner = teamAgents.find((agent) => agent.id === editOwnerAgentId);

    let nextPhases = project.phases;
    if (trimmedPhaseTitle) {
      const nextPhase: ProjectPhase = {
        id: currentPhase?.id || `${project.id}-${slugify(trimmedPhaseTitle || "phase")}`,
        title: trimmedPhaseTitle,
        status: editPhaseStatus,
        ownerAgentId: editOwnerAgentId || undefined,
        dependsOnPhaseIds: currentPhase?.dependsOnPhaseIds || [],
      };

      nextPhases = currentPhase
        ? project.phases.map((phase) => (phase.id === currentPhase.id ? { ...phase, ...nextPhase } : phase))
        : [nextPhase, ...project.phases];
    }

    try {
      const response = await fetch("/api/projects", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: project.id,
          status: editStatus,
          progress: editProgress,
          ownerAgentId: editOwnerAgentId || null,
          agent: selectedOwner
            ? { emoji: selectedOwner.emoji, name: selectedOwner.name, color: selectedOwner.color }
            : unassignedAgent,
          phases: nextPhases,
          updatedAgo: "just now",
          updatedBy: "Mission Control",
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to update project");
      }

      onUpdate?.();
      setEditing(false);
    } catch (error) {
      console.error("Failed to update project:", error);
      setSaveError(error instanceof Error ? error.message : "Failed to update project");
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
        {editing && (
          <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: "var(--surface-elevated)", border: "1px solid var(--border)" }}>
            <div className="mb-3">
              <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                Project owner and current phase
              </p>
              <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>
                This edits planning metadata only. It does not imply Projects already has full operational CRUD or dependency management.
              </p>
            </div>

            <div className="mb-3">
              <label className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: "var(--text-muted)" }}>
                Owner
              </label>
              <select
                value={editOwnerAgentId}
                onChange={(e) => setEditOwnerAgentId(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{
                  backgroundColor: "var(--card)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border)",
                }}
              >
                <option value="">Unassigned</option>
                {teamAgents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.emoji} {agent.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-3">
              <label className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: "var(--text-muted)" }}>
                Current phase
              </label>
              <input
                value={editPhaseTitle}
                onChange={(e) => setEditPhaseTitle(e.target.value)}
                placeholder="e.g. API stabilization"
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{
                  backgroundColor: "var(--card)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border)",
                }}
              />
              <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                Leave blank to keep the current phase list unchanged.
              </p>
            </div>

            <div className="mb-3">
              <label className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: "var(--text-muted)" }}>
                Phase status
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {phaseStatusOptions.map((phaseStatus) => {
                  const config = phaseStatusConfig[phaseStatus];
                  const isActive = editPhaseStatus === phaseStatus;
                  return (
                    <button
                      key={phaseStatus}
                      type="button"
                      onClick={() => setEditPhaseStatus(phaseStatus)}
                      className="text-[10px] font-bold px-2 py-1 rounded-full transition-all"
                      style={{
                        backgroundColor: isActive ? `color-mix(in srgb, ${config.color} 25%, transparent)` : "transparent",
                        color: isActive ? config.color : "var(--text-muted)",
                        border: `1px solid ${isActive ? config.color : "var(--border)"}`,
                      }}
                    >
                      {config.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-3">
              <label className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: "var(--text-muted)" }}>
                Status
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {projectStatusOptions.map((projectStatus) => {
                  const config = statusConfig[projectStatus];
                  const isActive = editStatus === projectStatus;
                  return (
                    <button
                      key={projectStatus}
                      type="button"
                      onClick={() => setEditStatus(projectStatus)}
                      className="text-[10px] font-bold px-2 py-1 rounded-full transition-all"
                      style={{
                        backgroundColor: isActive ? `color-mix(in srgb, ${config.color} 25%, transparent)` : "transparent",
                        color: isActive ? config.color : "var(--text-muted)",
                        border: `1px solid ${isActive ? config.color : "var(--border)"}`,
                      }}
                    >
                      {config.label}
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

            {saveError && (
              <p className="text-xs mb-3" style={{ color: "var(--text-error, #ef4444)" }}>
                {saveError}
              </p>
            )}

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  resetDraft();
                  setEditing(false);
                }}
                className="text-xs px-3 py-1 rounded-lg"
                style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}
              >
                Cancel
              </button>
              <button
                type="button"
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

        <p className="text-sm mb-4 line-clamp-2" style={{ color: "var(--text-secondary)" }}>
          {project.description}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div
            className="rounded-lg px-3 py-2"
            style={{ backgroundColor: "var(--surface-elevated)", border: "1px solid var(--border)" }}
          >
            <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
              Owner
            </p>
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0"
                style={{
                  backgroundColor: `${displayOwner.color}20`,
                  border: `1.5px solid ${displayOwner.color}40`,
                }}
              >
                {displayOwner.emoji}
              </div>
              <span className="text-xs font-medium truncate" style={{ color: "var(--text-secondary)" }}>
                {displayOwner.name}
              </span>
            </div>
          </div>

          <div
            className="rounded-lg px-3 py-2"
            style={{ backgroundColor: "var(--surface-elevated)", border: "1px solid var(--border)" }}
          >
            <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
              Current phase
            </p>
            {currentPhase ? (
              <div className="min-w-0">
                <p className="text-xs font-medium truncate" style={{ color: "var(--text-secondary)" }}>
                  {currentPhase.title}
                </p>
                <span
                  className="inline-flex mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${currentPhaseStatus?.color || "#8E8E93"} 15%, transparent)`,
                    color: currentPhaseStatus?.color || "#8E8E93",
                    border: `1px solid color-mix(in srgb, ${currentPhaseStatus?.color || "#8E8E93"} 30%, transparent)`,
                  }}
                >
                  {currentPhaseStatus?.label || "Unknown"}
                </span>
              </div>
            ) : (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                No phase set yet
              </p>
            )}
          </div>
        </div>

        {/* Participating agents section */}
        {participatingCount > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                Participating agents
              </span>
              {participatingCount > 3 && (
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {participatingCount - 3} more
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {participatingAgents.map((agent) => (
                <div
                  key={agent.id}
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0"
                  style={{
                    backgroundColor: `${agent.color}20`,
                    border: `1.5px solid ${agent.color}40`,
                  }}
                  title={`${agent.name} (${agent.role || "Team member"})`}
                >
                  {agent.emoji}
                </div>
              ))}
              {participatingCount > participatingAgents.length && (
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] flex-shrink-0"
                  style={{
                    backgroundColor: "var(--surface-elevated)",
                    border: "1.5px solid var(--border)",
                    color: "var(--text-muted)",
                  }}
                  title={`${participatingCount} total participating agents`}
                >
                  {participatingCount}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold" style={{ color: status.color }}>
              {project.progress}%
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--surface-elevated)" }}>
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

        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            {project.updatedAgo}
            {project.updatedBy ? ` by ${project.updatedBy}` : ""}
          </span>

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

        {!editing && (
          <button
            type="button"
            onClick={() => {
              resetDraft();
              setEditing(true);
            }}
            className="mt-3 w-full text-[10px] font-medium py-1.5 rounded-lg transition-colors"
            style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--surface-hover)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            Edit owner / phase
          </button>
        )}
      </div>
    </div>
  );
}
