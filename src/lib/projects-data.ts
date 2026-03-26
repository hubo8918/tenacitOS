import fs from "fs/promises";
import path from "path";
import type {
  Project,
  ProjectPhase,
  ProjectPhaseExecutionMode,
  ProjectPhaseLatestRun,
  ProjectPhaseRunFields,
  ProjectPhaseRunIntent,
  ProjectPhaseRunKind,
  ProjectPhaseRunStatus,
} from "@/data/mockProjectsData";

const DATA_PATH = path.join(process.cwd(), "data", "projects.json");

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function normalizeProjectStatus(value: unknown): Project["status"] {
  return value === "active" || value === "paused" || value === "completed" ? value : "planning";
}

function normalizeProjectPriority(value: unknown): Project["priority"] {
  return value === "high" || value === "low" ? value : "medium";
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function normalizeProjectPhaseRunStatus(value: unknown): ProjectPhaseRunStatus | undefined {
  return value === "idle" ||
    value === "queued" ||
    value === "running" ||
    value === "needs_review" ||
    value === "done" ||
    value === "failed"
    ? value
    : undefined;
}

function normalizeProjectPhaseRunKind(value: unknown): ProjectPhaseRunKind {
  return value === "agent_packet" ? "agent_packet" : "manual";
}

function normalizeProjectPhaseRunIntent(value: unknown): ProjectPhaseRunIntent {
  return value === "review" || value === "debug" || value === "agent_check_in" || value === "agent_wake"
    ? value
    : "start";
}

function normalizeProjectPhaseExecutionMode(value: unknown): ProjectPhaseExecutionMode | undefined {
  return value === "manual" || value === "agent-run" ? value : undefined;
}

function normalizeProjectPhaseRunFields(value: unknown): ProjectPhaseRunFields | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const fields = value as Record<string, unknown>;
  const normalized: ProjectPhaseRunFields = {};

  if (asNonEmptyString(fields.status)) normalized.status = asNonEmptyString(fields.status);
  if (asNonEmptyString(fields.focus)) normalized.focus = asNonEmptyString(fields.focus);
  if (asNonEmptyString(fields.next)) normalized.next = asNonEmptyString(fields.next);
  if (asNonEmptyString(fields.blockers)) normalized.blockers = asNonEmptyString(fields.blockers);
  if (asNonEmptyString(fields.needsFromHuman)) {
    normalized.needsFromHuman = asNonEmptyString(fields.needsFromHuman);
  }
  if (asNonEmptyString(fields.decision)) normalized.decision = asNonEmptyString(fields.decision);
  if (asNonEmptyString(fields.handoffTo)) normalized.handoffTo = asNonEmptyString(fields.handoffTo);
  if (asNonEmptyString(fields.reviewerAgentId)) {
    normalized.reviewerAgentId = asNonEmptyString(fields.reviewerAgentId);
  }
  if (asNonEmptyString(fields.reviewerName)) {
    normalized.reviewerName = asNonEmptyString(fields.reviewerName);
  }

  return Object.keys(normalized).length > 0 ? normalized : null;
}

function normalizeProjectPhaseLatestRun(runLike: unknown): ProjectPhaseLatestRun | null {
  if (!runLike || typeof runLike !== "object" || Array.isArray(runLike)) return null;

  const run = asRecord(runLike);
  const id = asNonEmptyString(run.id);
  const timestamp = asNonEmptyString(run.timestamp);
  if (!id || !timestamp) return null;

  return {
    id,
    kind: normalizeProjectPhaseRunKind(run.kind),
    intent: normalizeProjectPhaseRunIntent(run.intent),
    action:
      run.action === "check-in" || run.action === "wake" || run.action === "review"
        ? run.action
        : undefined,
    timestamp,
    runStatus: normalizeProjectPhaseRunStatus(run.runStatus),
    executionMode: normalizeProjectPhaseExecutionMode(run.executionMode),
    deliverable: asString(run.deliverable),
    text: asString(run.text),
    agentId: asString(run.agentId),
    agentName: asString(run.agentName),
    model: asString(run.model),
    sessionId: asString(run.sessionId),
    runId: asString(run.runId),
    thinking: asString(run.thinking),
    fields: normalizeProjectPhaseRunFields(run.fields),
  };
}

function normalizeProjectPhase(phaseLike: unknown): ProjectPhase {
  const phase = asRecord(phaseLike);
  return {
    id: asString(phase.id) || "",
    title: asString(phase.title) || "Untitled phase",
    status:
      phase.status === "in_progress" || phase.status === "blocked" || phase.status === "completed"
        ? phase.status
        : "pending",
    ownerAgentId: asString(phase.ownerAgentId),
    reviewerAgentId: asString(phase.reviewerAgentId),
    handoffToAgentId: asString(phase.handoffToAgentId),
    dependsOnPhaseIds: asStringArray(phase.dependsOnPhaseIds),
    latestRun: normalizeProjectPhaseLatestRun(phase.latestRun),
  };
}

export function normalizeProject(projectLike: unknown): Project {
  const project = asRecord(projectLike);
  const agent = asRecord(project.agent);

  return {
    id: asString(project.id) || "",
    title: asString(project.title) || "Untitled project",
    description: asString(project.description) || "",
    status: normalizeProjectStatus(project.status),
    progress: typeof project.progress === "number" ? project.progress : 0,
    priority: normalizeProjectPriority(project.priority),
    agent: {
      emoji: asString(agent.emoji) || "👤",
      name: asString(agent.name) || "Unassigned",
      color: asString(agent.color) || "#8E8E93",
    },
    updatedAgo: asString(project.updatedAgo) || "just now",
    updatedBy: asString(project.updatedBy) || "",
    ownerAgentId: asString(project.ownerAgentId),
    participatingAgentIds: asStringArray(project.participatingAgentIds),
    phases: Array.isArray(project.phases) ? project.phases.map((phase) => normalizeProjectPhase(phase)) : [],
  };
}

export async function getProjects(): Promise<Project[]> {
  try {
    const data = await fs.readFile(DATA_PATH, "utf-8");
    const parsed = JSON.parse(data) as unknown;
    return Array.isArray(parsed) ? parsed.map((project) => normalizeProject(project)) : [];
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

export async function saveProjects(projects: Project[]): Promise<void> {
  const dir = path.dirname(DATA_PATH);

  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }

  await fs.writeFile(DATA_PATH, JSON.stringify(projects, null, 2));
}
