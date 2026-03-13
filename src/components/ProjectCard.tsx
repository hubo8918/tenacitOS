"use client";

import { useMemo, useState } from "react";
import { priorityConfig, statusConfig, type Project, type ProjectPhase } from "@/data/mockProjectsData";
import { taskStatusConfig, type Task } from "@/data/mockTasksData";
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

function parseLocalDate(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function isTaskOverdue(dateString: string, status: Task["status"]) {
  if (status === "completed") {
    return false;
  }

  const dueDate = parseLocalDate(dateString);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return dueDate < startOfToday;
}

function isUrgentLinkedTask(task: Task) {
  return task.status === "blocked" || isTaskOverdue(task.dueDate, task.status);
}

function getLinkedTaskAttentionSummary(tasks: Task[]) {
  const openCount = tasks.filter((task) => task.status !== "completed").length;
  const blockedCount = tasks.filter((task) => task.status === "blocked").length;
  const overdueCount = tasks.filter((task) => isTaskOverdue(task.dueDate, task.status)).length;

  return { openCount, blockedCount, overdueCount };
}

function compareLinkedTaskPreviewPriority(a: Task, b: Task) {
  const getRank = (task: Task) => {
    if (task.status === "blocked") return 0;
    if (isTaskOverdue(task.dueDate, task.status)) return 1;
    if (task.status !== "completed") return 2;
    return 3;
  };

  const rankDiff = getRank(a) - getRank(b);
  if (rankDiff !== 0) {
    return rankDiff;
  }

  const dueDateDiff = parseLocalDate(a.dueDate).getTime() - parseLocalDate(b.dueDate).getTime();
  if (dueDateDiff !== 0) {
    return dueDateDiff;
  }

  return a.title.localeCompare(b.title);
}

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

function getProjectTasksHref(
  projectTitle: string,
  projectId?: string,
  taskId?: string,
  taskSource?: "linked-preview" | "urgent-overflow"
) {
  const params = new URLSearchParams({ project: projectTitle });
  if (projectId) {
    params.set("projectId", projectId);
  }
  if (taskId) {
    params.set("task", taskId);
  }
  if (taskSource) {
    params.set("taskSource", taskSource);
  }
  return `/agents/tasks?${params.toString()}`;
}

interface ProjectCardProps {
  project: Project;
  teamAgents: TeamAgent[];
  linkedTasks: Task[];
  linkedTasksLoading?: boolean;
  linkedTasksUnavailable?: boolean;
  onUpdate?: () => void;
}

export function ProjectCard({
  project,
  teamAgents,
  linkedTasks,
  linkedTasksLoading = false,
  linkedTasksUnavailable = false,
  onUpdate,
}: ProjectCardProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editStatus, setEditStatus] = useState(project.status);
  const [editProgress, setEditProgress] = useState(project.progress);
  const [editOwnerAgentId, setEditOwnerAgentId] = useState(project.ownerAgentId || "");
  const [editParticipatingAgentIds, setEditParticipatingAgentIds] = useState<string[]>([...project.participatingAgentIds]);
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
  const currentPhaseDependencies = useMemo(() => {
    if (!currentPhase) {
      return { resolved: [] as ProjectPhase[], unresolvedIds: [] as string[] };
    }

    const phaseById = new Map(project.phases.map((phase) => [phase.id, phase]));
    const resolved: ProjectPhase[] = [];
    const unresolvedIds: string[] = [];

    for (const phaseId of currentPhase.dependsOnPhaseIds) {
      const phase = phaseById.get(phaseId);
      if (phase) {
        resolved.push(phase);
      } else {
        unresolvedIds.push(phaseId);
      }
    }

    return { resolved, unresolvedIds };
  }, [currentPhase, project.phases]);
  const sortedLinkedTasks = useMemo(() => [...linkedTasks].sort(compareLinkedTaskPreviewPriority), [linkedTasks]);
  const visibleLinkedTasks = useMemo(() => sortedLinkedTasks.slice(0, 3), [sortedLinkedTasks]);
  const firstHiddenUrgentLinkedTask = useMemo(
    () => sortedLinkedTasks.slice(3).find(isUrgentLinkedTask) || null,
    [sortedLinkedTasks]
  );
  const hiddenUrgentLinkedTaskCount = useMemo(
    () => sortedLinkedTasks.slice(3).filter(isUrgentLinkedTask).length,
    [sortedLinkedTasks]
  );
  const linkedTaskAttention = useMemo(() => getLinkedTaskAttentionSummary(linkedTasks), [linkedTasks]);
  const projectTasksHref = getProjectTasksHref(project.title, project.id);
  const urgentOverflowTasksHref = getProjectTasksHref(project.title, project.id, firstHiddenUrgentLinkedTask?.id, "urgent-overflow");

  const resetDraft = () => {
    const nextPhase = getCurrentPhase(project);
    setEditStatus(project.status);
    setEditProgress(project.progress);
    setEditOwnerAgentId(project.ownerAgentId || "");
    setEditParticipatingAgentIds([...project.participatingAgentIds]);
    setEditPhaseTitle(nextPhase?.title || "");
    setEditPhaseStatus(nextPhase?.status || "pending");
    setSaveError(null);
    setDeleteError(null);
    setConfirmDelete(false);
  };

  const toggleParticipatingAgent = (agentId: string) => {
    setEditParticipatingAgentIds((current) =>
      current.includes(agentId)
        ? current.filter((value) => value !== agentId)
        : [...current, agentId]
    );
  };

  async function handleSave() {
    if (saving || deleting) return;

    setSaving(true);
    setSaveError(null);
    setDeleteError(null);

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
          participatingAgentIds: editParticipatingAgentIds,
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

  async function handleDelete() {
    if (saving || deleting) return;

    setDeleting(true);
    setDeleteError(null);
    setSaveError(null);

    try {
      const response = await fetch(`/api/projects?id=${encodeURIComponent(project.id)}`, {
        method: "DELETE",
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to delete project");
      }

      setConfirmDelete(false);
      setEditing(false);
      onUpdate?.();
    } catch (error) {
      console.error("Failed to delete project:", error);
      setDeleteError(error instanceof Error ? error.message : "Failed to delete project");
    } finally {
      setDeleting(false);
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
                Project planning metadata
              </p>
              <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>
                This now edits owner, participating agents, current phase, status, and progress in one honest planning surface. Current phase dependency visibility stays read-only here, and linked-task cleanup still lives on Tasks.
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
                Participating agents
              </label>
              <div
                className="rounded-lg p-2 space-y-1.5"
                style={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                }}
              >
                {teamAgents.length > 0 ? (
                  teamAgents.map((agent) => (
                    <label
                      key={agent.id}
                      className="flex items-center gap-2 text-xs"
                      style={{ color: "var(--text-primary)" }}
                    >
                      <input
                        type="checkbox"
                        checked={editParticipatingAgentIds.includes(agent.id)}
                        onChange={() => toggleParticipatingAgent(agent.id)}
                      />
                      <span>
                        {agent.emoji} {agent.name}
                      </span>
                    </label>
                  ))
                ) : (
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    No team agents available.
                  </p>
                )}
              </div>
              <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>
                Planning metadata only. Owner stays separate, so include them here only when they should count as an active participant too.
              </p>
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

            <div
              className="mb-3 rounded-lg px-3 py-2"
              style={{
                backgroundColor: "color-mix(in srgb, var(--status-blocked, #FF453A) 10%, transparent)",
                border: "1px solid color-mix(in srgb, var(--status-blocked, #FF453A) 24%, transparent)",
              }}
            >
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--status-blocked, #FF453A)" }}>
                Delete project
              </p>
              <p className="mt-1 text-[10px]" style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>
                Deleting this project removes the Projects card and saved project record only. {linkedTasks.length > 0
                  ? `${linkedTasks.length} linked task${linkedTasks.length === 1 ? " still uses" : "s still use"} this title on the Tasks board and ${linkedTasks.length === 1 ? "will" : "will all"} need cleanup there afterward instead of pretending deletion updates task labels automatically.`
                  : "No current Tasks labels point here, so deletion only removes the project record."}
              </p>

              {deleteError && (
                <p className="mt-2 text-xs" style={{ color: "var(--text-error, #ef4444)" }}>
                  {deleteError}
                </p>
              )}

              {confirmDelete ? (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[10px]" style={{ color: "var(--text-secondary)", lineHeight: 1.4 }}>
                    Confirm deletion of <span style={{ color: "var(--text-primary)" }}>{project.title}</span>.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmDelete(false);
                        setDeleteError(null);
                      }}
                      disabled={deleting}
                      className="text-xs px-3 py-1 rounded-lg"
                      style={{ color: "var(--text-muted)", border: "1px solid var(--border)", opacity: deleting ? 0.6 : 1 }}
                    >
                      Keep project
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="text-xs px-3 py-1 rounded-lg font-medium"
                      style={{ backgroundColor: "var(--status-blocked, #FF453A)", color: "#fff", opacity: deleting ? 0.7 : 1 }}
                    >
                      {deleting ? "Deleting..." : "Delete project"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmDelete(true);
                      setDeleteError(null);
                    }}
                    disabled={saving || deleting}
                    className="text-xs px-3 py-1 rounded-lg font-medium"
                    style={{
                      color: "var(--status-blocked, #FF453A)",
                      border: "1px solid color-mix(in srgb, var(--status-blocked, #FF453A) 32%, transparent)",
                      opacity: saving || deleting ? 0.6 : 1,
                    }}
                  >
                    Delete…
                  </button>
                </div>
              )}
            </div>

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
                disabled={saving || deleting}
                className="text-xs px-3 py-1 rounded-lg font-medium"
                style={{ backgroundColor: "#0A84FF", color: "#fff", opacity: saving || deleting ? 0.6 : 1 }}
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

        {currentPhase && currentPhase.dependsOnPhaseIds.length > 0 && (
          <div
            className="mb-4 rounded-lg px-3 py-2"
            style={{ backgroundColor: "var(--surface-elevated)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                Phase dependencies
              </span>
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                {currentPhase.dependsOnPhaseIds.length} tracked
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {currentPhaseDependencies.resolved.map((phase) => {
                const config = phaseStatusConfig[phase.status];
                return (
                  <span
                    key={phase.id}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${config.color} 12%, transparent)`,
                      color: config.color,
                      border: `1px solid color-mix(in srgb, ${config.color} 28%, transparent)`,
                    }}
                    title={`${phase.title} (${config.label})`}
                  >
                    <span>{phase.title}</span>
                    <span style={{ color: "var(--text-muted)" }}>{config.label}</span>
                  </span>
                );
              })}

              {currentPhaseDependencies.unresolvedIds.length > 0 && (
                <span
                  className="inline-flex items-center rounded-full px-2 py-1 text-[10px] font-medium"
                  style={{
                    backgroundColor: "var(--surface-hover)",
                    color: "var(--text-secondary)",
                    border: "1px solid var(--border)",
                  }}
                  title={currentPhaseDependencies.unresolvedIds.join(", ")}
                >
                  {currentPhaseDependencies.unresolvedIds.length} unresolved
                </span>
              )}
            </div>

            {currentPhaseDependencies.unresolvedIds.length > 0 && (
              <p className="mt-2 text-[10px]" style={{ color: "var(--text-muted)", lineHeight: 1.4 }}>
                Some dependency IDs are still stored without a matching phase on this project, so this stays read-only until Projects has a narrower dependency editor.
              </p>
            )}
          </div>
        )}

        <div
          className="mb-4 rounded-lg px-3 py-2"
          style={{ backgroundColor: "var(--surface-elevated)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
              Linked tasks
            </span>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              {linkedTasksLoading
                ? "Loading..."
                : linkedTasksUnavailable
                  ? "Unavailable"
                  : linkedTasks.length > 0
                    ? [
                        `${linkedTasks.length} total`,
                        `${linkedTaskAttention.openCount} open`,
                        linkedTaskAttention.blockedCount > 0 ? `${linkedTaskAttention.blockedCount} blocked` : null,
                        linkedTaskAttention.overdueCount > 0 ? `${linkedTaskAttention.overdueCount} overdue` : null,
                      ]
                        .filter(Boolean)
                        .join(" • ")
                    : "0 linked"}
            </span>
          </div>

          {linkedTasksLoading ? (
            <p className="text-[10px]" style={{ color: "var(--text-muted)", lineHeight: 1.4 }}>
              Loading task linkage from the Tasks board...
            </p>
          ) : linkedTasksUnavailable ? (
            <p className="text-[10px]" style={{ color: "var(--text-muted)", lineHeight: 1.4 }}>
              Tasks data is unavailable right now, so project linkage stays read-only until the Tasks board can be loaded again.
            </p>
          ) : linkedTasks.length > 0 ? (
            <div className="space-y-2">
              {visibleLinkedTasks.map((task) => {
                const taskStatus = taskStatusConfig[task.status];
                const isOverdueTask = isTaskOverdue(task.dueDate, task.status);
                const linkedTaskHref = getProjectTasksHref(project.title, project.id, task.id, "linked-preview");
                return (
                  <div key={task.id} className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <a
                        href={linkedTaskHref}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-medium truncate hover:underline"
                        style={{ color: "var(--text-secondary)" }}
                        title={`Open ${task.title} in the focused Tasks view`}
                      >
                        {task.title}
                      </a>
                      <p
                        className="text-[10px]"
                        style={{ color: isOverdueTask ? "var(--status-blocked)" : "var(--text-muted)" }}
                      >
                        {task.dueDate
                          ? isOverdueTask
                            ? `Overdue since ${task.dueDate}`
                            : `Due ${task.dueDate}`
                          : "No due date"}
                      </p>
                    </div>
                    <span
                      className="inline-flex items-center rounded-full px-2 py-1 text-[10px] font-medium whitespace-nowrap"
                      style={{
                        backgroundColor: `color-mix(in srgb, ${taskStatus.color} 12%, transparent)`,
                        color: taskStatus.color,
                        border: `1px solid color-mix(in srgb, ${taskStatus.color} 28%, transparent)`,
                      }}
                    >
                      {taskStatus.label}
                    </span>
                  </div>
                );
              })}

              {hiddenUrgentLinkedTaskCount > 0 && firstHiddenUrgentLinkedTask && (
                <div
                  className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2"
                  style={{ backgroundColor: "var(--surface-hover)", border: "1px solid var(--border)" }}
                >
                  <div className="min-w-0">
                    <p className="text-[10px]" style={{ color: "var(--text-secondary)", lineHeight: 1.4 }}>
                      {hiddenUrgentLinkedTaskCount} more blocked or overdue linked task
                      {hiddenUrgentLinkedTaskCount === 1 ? "" : "s"} sit beyond this three-row preview.
                    </p>
                    <p className="text-[10px] truncate" style={{ color: "var(--text-muted)", lineHeight: 1.4 }}>
                      Current hidden urgent target: {firstHiddenUrgentLinkedTask.title}
                      {firstHiddenUrgentLinkedTask.status === "blocked"
                        ? " · blocked"
                        : isTaskOverdue(firstHiddenUrgentLinkedTask.dueDate, firstHiddenUrgentLinkedTask.status)
                          ? ` · overdue since ${firstHiddenUrgentLinkedTask.dueDate}`
                          : ""}
                    </p>
                    <p className="text-[10px]" style={{ color: "var(--text-muted)", lineHeight: 1.4 }}>
                      If the earlier urgent-overflow target already moved or disappeared, this shortcut retargets to the current first hidden urgent task instead of dead-ending.
                    </p>
                  </div>
                  <a
                    href={urgentOverflowTasksHref}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] font-medium whitespace-nowrap"
                    style={{ color: "#0A84FF" }}
                    title={`Open ${firstHiddenUrgentLinkedTask.title} in the focused Tasks view`}
                  >
                    Open current urgent task ↗
                  </a>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-1">
                <p className="text-[10px]" style={{ color: "var(--text-muted)", lineHeight: 1.4 }}>
                  Read-only summary from Tasks based on current task project labels; editing still lives on the Tasks board.
                </p>
                <a
                  href={projectTasksHref}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] font-medium whitespace-nowrap"
                  style={{ color: "#0A84FF" }}
                >
                  {linkedTasks.length > visibleLinkedTasks.length ? "View all in Tasks ↗" : "Open in Tasks ↗"}
                </a>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[10px]" style={{ color: "var(--text-muted)", lineHeight: 1.4 }}>
                No tasks currently link back to this project from the Tasks board labels saved on each task.
              </p>
              <div className="flex items-center justify-between gap-2 pt-1">
                <p className="text-[10px]" style={{ color: "var(--text-muted)", lineHeight: 1.4 }}>
                  Projects stays read-only for linkage here; open the focused Tasks view for this project, then use New task there if you want the intake form to start with this tracked project already selected.
                </p>
                <a
                  href={projectTasksHref}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] font-medium whitespace-nowrap"
                  style={{ color: "#0A84FF" }}
                >
                  Open focused Tasks ↗
                </a>
              </div>
            </div>
          )}
        </div>

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
            Edit project plan
          </button>
        )}
      </div>
    </div>
  );
}
