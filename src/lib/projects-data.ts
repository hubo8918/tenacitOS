import fs from "fs/promises";
import path from "path";
import {
  projects as seededProjects,
  type Project,
  type ProjectPhase,
  type ProjectPhaseExecutionMode,
  type ProjectPhaseLatestRun,
  type ProjectPhaseRunFields,
  type ProjectPhaseRunIntent,
  type ProjectPhaseRunKind,
  type ProjectPhaseRunStatus,
} from "@/data/mockProjectsData";
import { teamAgents } from "@/data/mockTeamData";

const DATA_PATH = path.join(process.cwd(), "data", "projects.json");
const TEAM_BY_ID = new Map(teamAgents.map((agent) => [agent.id, agent]));
const TEAM_BY_NAME = new Map(teamAgents.map((agent) => [agent.name.trim().toLowerCase(), agent]));
const SEEDED_PROJECTS_BY_ID = new Map(seededProjects.map((project) => [project.id, project]));

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null;
}

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
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
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

function resolveAgentRecord(id?: string, name?: string) {
  if (id && TEAM_BY_ID.has(id)) {
    return TEAM_BY_ID.get(id);
  }
  if (name) {
    return TEAM_BY_NAME.get(name.trim().toLowerCase());
  }
  return undefined;
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
  const canonicalAgent = resolveAgentRecord(asString(project.ownerAgentId), asString(agent.name));

  return {
    id: asString(project.id) || "",
    title: asString(project.title) || "Untitled project",
    description: asString(project.description) || "",
    status: normalizeProjectStatus(project.status),
    progress: typeof project.progress === "number" ? project.progress : 0,
    priority: normalizeProjectPriority(project.priority),
    agent: canonicalAgent
      ? {
          emoji: canonicalAgent.emoji,
          name: canonicalAgent.name,
          color: canonicalAgent.color,
        }
      : {
          emoji: asString(agent.emoji) || "\u{1F464}",
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

function samePhaseList(left: ProjectPhase[], right: ProjectPhase[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function migrateProject(project: Project): { project: Project; changed: boolean } {
  const seeded = SEEDED_PROJECTS_BY_ID.get(project.id);
  const ownerAgentId = project.ownerAgentId || resolveAgentRecord(undefined, project.agent.name)?.id || seeded?.ownerAgentId;
  const canonicalOwner = resolveAgentRecord(ownerAgentId, project.agent.name);
  const agent = canonicalOwner
    ? {
        emoji: canonicalOwner.emoji,
        name: canonicalOwner.name,
        color: canonicalOwner.color,
      }
    : project.agent;
  const participatingAgentIds =
    project.participatingAgentIds.length > 0
      ? project.participatingAgentIds
      : seeded?.participatingAgentIds?.length
        ? [...seeded.participatingAgentIds]
        : ownerAgentId
          ? [ownerAgentId]
          : [];
  const phases =
    project.phases.length > 0
      ? project.phases
      : seeded?.phases?.map((phase) => normalizeProjectPhase(phase)) || [];

  const nextProject: Project = {
    ...project,
    ownerAgentId,
    agent,
    participatingAgentIds,
    phases,
  };

  const changed =
    nextProject.ownerAgentId !== project.ownerAgentId ||
    nextProject.agent.name !== project.agent.name ||
    nextProject.agent.emoji !== project.agent.emoji ||
    nextProject.agent.color !== project.agent.color ||
    JSON.stringify(nextProject.participatingAgentIds) !== JSON.stringify(project.participatingAgentIds) ||
    !samePhaseList(nextProject.phases, project.phases);

  return { project: nextProject, changed };
}

export async function getProjects(): Promise<Project[]> {
  try {
    const data = await fs.readFile(DATA_PATH, "utf-8");
    let parsed: unknown;
    try {
      parsed = JSON.parse(data) as unknown;
    } catch (error) {
      throw new Error(
        `Failed to parse ${DATA_PATH}. Fix or replace the corrupted JSON before Mission Control can load projects.`,
        { cause: error }
      );
    }
    const normalized = Array.isArray(parsed) ? parsed.map((project) => normalizeProject(project)) : [];

    let didMigrate = false;
    const nextProjects = normalized.map((project) => {
      const migrated = migrateProject(project);
      if (migrated.changed) {
        didMigrate = true;
      }
      return migrated.project;
    });

    if (didMigrate) {
      await saveProjects(nextProjects);
    }

    return nextProjects;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      const seeded = seededProjects.map((project) => normalizeProject(project));
      await saveProjects(seeded);
      return seeded;
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

  const normalized = projects.map((project) => migrateProject(normalizeProject(project)).project);
  await fs.writeFile(DATA_PATH, JSON.stringify(normalized, null, 2));
}
