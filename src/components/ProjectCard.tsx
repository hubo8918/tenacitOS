"use client";

import Link from "next/link";

import { priorityConfig, statusConfig, type Project, type ProjectPhase } from "@/data/mockProjectsData";

interface ProjectCardProps {
  cardId?: string;
  project: Project;
  linkedTaskCount: number;
  selectedPhaseId?: string | null;
  isSelectedProject?: boolean;
  isTemporarilyHighlighted?: boolean;
  onSelectProject?: () => void;
  onSelectPhase?: (phaseId: string) => void;
}

function getCurrentPhase(project: Project): ProjectPhase | null {
  return (
    project.phases.find((phase) => phase.status === "in_progress") ||
    project.phases.find((phase) => phase.status === "pending") ||
    project.phases[0] ||
    null
  );
}

function phaseTone(status: ProjectPhase["status"]) {
  if (status === "completed") return "#32D74B";
  if (status === "blocked") return "#FF453A";
  if (status === "in_progress") return "#0A84FF";
  return "#FFD60A";
}

export function ProjectCard({
  cardId,
  project,
  linkedTaskCount,
  selectedPhaseId = null,
  isSelectedProject = false,
  isTemporarilyHighlighted = false,
  onSelectProject,
  onSelectPhase,
}: ProjectCardProps) {
  const status = statusConfig[project.status];
  const priority = priorityConfig[project.priority];
  const currentPhase = getCurrentPhase(project);
  const reviewNeededCount = project.phases.filter((phase) => phase.latestRun?.runStatus === "needs_review").length;

  return (
    <div
      id={cardId}
      className="rounded-xl p-4 transition-colors"
      style={{
        backgroundColor: "var(--card)",
        border: isTemporarilyHighlighted
          ? "1px solid color-mix(in srgb, #0A84FF 48%, transparent)"
          : isSelectedProject
          ? "1px solid color-mix(in srgb, #0A84FF 34%, transparent)"
          : "1px solid var(--border)",
        boxShadow: isTemporarilyHighlighted ? "0 0 0 2px rgba(10, 132, 255, 0.15)" : "none",
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <button type="button" onClick={onSelectProject} className="min-w-0 text-left">
          <p className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            {project.title}
          </p>
          <p className="mt-2 text-sm" style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
            {project.description}
          </p>
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full px-2 py-1 text-[10px] font-semibold" style={{ color: status.color, backgroundColor: `${status.color}1A` }}>
            {status.label}
          </span>
          <span className="rounded-full px-2 py-1 text-[10px] font-semibold" style={{ color: priority.color, backgroundColor: `${priority.color}1A` }}>
            {priority.label}
          </span>
          {reviewNeededCount > 0 && (
            <span className="rounded-full px-2 py-1 text-[10px] font-semibold" style={{ color: "#FF9F0A", backgroundColor: "color-mix(in srgb, #FF9F0A 12%, transparent)" }}>
              {reviewNeededCount} in review
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-lg px-3 py-2" style={{ backgroundColor: "var(--surface-elevated)", border: "1px solid var(--border)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Current phase
          </p>
          <p className="mt-1 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {currentPhase?.title || "No phases yet"}
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            {currentPhase?.status || "pending"}
          </p>
        </div>
        <div className="rounded-lg px-3 py-2" style={{ backgroundColor: "var(--surface-elevated)", border: "1px solid var(--border)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Linked tasks
          </p>
          <p className="mt-1 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {linkedTaskCount}
          </p>
          <Link
            href={`/agents/tasks?projectId=${encodeURIComponent(project.id)}`}
            className="mt-2 inline-flex text-xs font-semibold"
            style={{ color: "#0A84FF" }}
          >
            Open in Tasks
          </Link>
        </div>
        <div className="rounded-lg px-3 py-2" style={{ backgroundColor: "var(--surface-elevated)", border: "1px solid var(--border)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Owner
          </p>
          <p className="mt-1 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {project.agent.name}
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            Updated by {project.updatedBy || "Mission Control"}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          Phases
        </p>
        {project.phases.length === 0 ? (
          <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
            No tracked phases yet. Add the first phase in the planning panel so this project can start routing work.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {project.phases.map((phase) => {
              const tone = phaseTone(phase.status);
              const isSelected = selectedPhaseId === phase.id;
              return (
                <button
                  key={phase.id}
                  type="button"
                  onClick={() => onSelectPhase?.(phase.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left"
                  style={{
                    backgroundColor: isSelected ? "color-mix(in srgb, #0A84FF 10%, var(--surface-elevated))" : "var(--surface-elevated)",
                    border: isSelected ? "1px solid color-mix(in srgb, #0A84FF 28%, transparent)" : "1px solid var(--border)",
                  }}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      {phase.title}
                    </p>
                    <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                      {phase.ownerAgentId || "unassigned"} - {phase.reviewerAgentId || "needs reviewer"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {phase.latestRun?.runStatus === "needs_review" && (
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ color: "#FF9F0A", backgroundColor: "color-mix(in srgb, #FF9F0A 12%, transparent)" }}>
                        needs review
                      </span>
                    )}
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ color: tone, backgroundColor: `${tone}1A` }}>
                      {phase.status.replace(/_/g, " ")}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
