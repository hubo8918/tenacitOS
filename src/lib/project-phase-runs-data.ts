import fs from "fs/promises";
import path from "path";

import type { Project, ProjectPhase, ProjectPhaseLatestRun } from "@/data/mockProjectsData";
import { getProjects, normalizeProject, saveProjects } from "@/lib/projects-data";

const PROJECT_PHASE_RUNS_FILE = path.join(process.cwd(), "data", "project-phase-runs.json");

export interface ProjectPhaseRunAttempt extends ProjectPhaseLatestRun {
  projectId: string;
  projectTitle?: string;
  phaseId: string;
  phaseTitle?: string;
  userAgent?: string;
}

interface RecordProjectPhaseRunInput {
  projectId: string;
  projectTitle?: string;
  phaseId: string;
  phaseTitle?: string;
  userAgent?: string;
  phasePatch?: Partial<
    Pick<ProjectPhase, "status" | "ownerAgentId" | "reviewerAgentId" | "handoffToAgentId">
  >;
  run: Omit<ProjectPhaseLatestRun, "id" | "timestamp"> &
    Partial<Pick<ProjectPhaseLatestRun, "id" | "timestamp">>;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function normalizeRunStatus(value: unknown): ProjectPhaseLatestRun["runStatus"] {
  return value === "idle" ||
    value === "queued" ||
    value === "running" ||
    value === "needs_review" ||
    value === "done" ||
    value === "failed"
    ? value
    : undefined;
}

function normalizeExecutionMode(value: unknown): ProjectPhaseLatestRun["executionMode"] {
  return value === "manual" || value === "agent-run" ? value : undefined;
}

function normalizeIntent(value: unknown): ProjectPhaseLatestRun["intent"] {
  return value === "review" || value === "debug" || value === "agent_check_in" || value === "agent_wake"
    ? value
    : "start";
}

function normalizeAction(value: unknown): ProjectPhaseLatestRun["action"] {
  return value === "check-in" || value === "wake" || value === "review" ? value : undefined;
}

function normalizeFields(value: unknown): ProjectPhaseLatestRun["fields"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const fields = asRecord(value);
  const normalized = {
    status: asString(fields.status),
    focus: asString(fields.focus),
    next: asString(fields.next),
    blockers: asString(fields.blockers),
    needsFromHuman: asString(fields.needsFromHuman),
    decision: asString(fields.decision),
    handoffTo: asString(fields.handoffTo),
  };

  return Object.values(normalized).some(Boolean) ? normalized : null;
}

function normalizeProjectPhaseRunAttempt(runLike: unknown): ProjectPhaseRunAttempt | null {
  if (!runLike || typeof runLike !== "object" || Array.isArray(runLike)) return null;

  const run = asRecord(runLike);
  const id = asString(run.id);
  const projectId = asString(run.projectId);
  const phaseId = asString(run.phaseId);
  const timestamp = asString(run.timestamp);
  if (!id || !projectId || !phaseId || !timestamp) return null;

  return {
    id,
    projectId,
    projectTitle: asString(run.projectTitle),
    phaseId,
    phaseTitle: asString(run.phaseTitle),
    userAgent: asString(run.userAgent),
    kind: run.kind === "agent_packet" ? "agent_packet" : "manual",
    intent: normalizeIntent(run.intent),
    action: normalizeAction(run.action),
    timestamp,
    runStatus: normalizeRunStatus(run.runStatus),
    executionMode: normalizeExecutionMode(run.executionMode),
    deliverable: asString(run.deliverable),
    text: asString(run.text),
    agentId: asString(run.agentId),
    agentName: asString(run.agentName),
    model: asString(run.model),
    sessionId: asString(run.sessionId),
    runId: asString(run.runId),
    thinking: asString(run.thinking),
    fields: normalizeFields(run.fields),
  };
}

function buildRunId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function saveProjectPhaseRuns(attempts: ProjectPhaseRunAttempt[]): Promise<void> {
  const dir = path.dirname(PROJECT_PHASE_RUNS_FILE);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(PROJECT_PHASE_RUNS_FILE, JSON.stringify(attempts, null, 2), "utf-8");
}

export async function getProjectPhaseRuns(filters?: {
  projectId?: string;
  phaseId?: string;
  intent?: ProjectPhaseLatestRun["intent"];
}): Promise<ProjectPhaseRunAttempt[]> {
  try {
    const content = await fs.readFile(PROJECT_PHASE_RUNS_FILE, "utf-8");
    const parsed = JSON.parse(content) as unknown;
    const attempts = Array.isArray(parsed)
      ? parsed
          .map((entry) => normalizeProjectPhaseRunAttempt(entry))
          .filter((entry): entry is ProjectPhaseRunAttempt => Boolean(entry))
      : [];

    return attempts
      .filter((attempt) => !filters?.projectId || attempt.projectId === filters.projectId)
      .filter((attempt) => !filters?.phaseId || attempt.phaseId === filters.phaseId)
      .filter((attempt) => !filters?.intent || attempt.intent === filters.intent)
      .sort(
        (left, right) =>
          new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()
      );
  } catch {
    return [];
  }
}

function toPhaseLatestRun(attempt: ProjectPhaseRunAttempt): ProjectPhaseLatestRun {
  return {
    id: attempt.id,
    kind: attempt.kind,
    intent: attempt.intent,
    action: attempt.action,
    timestamp: attempt.timestamp,
    runStatus: attempt.runStatus,
    executionMode: attempt.executionMode,
    deliverable: attempt.deliverable,
    text: attempt.text,
    agentId: attempt.agentId,
    agentName: attempt.agentName,
    model: attempt.model,
    sessionId: attempt.sessionId,
    runId: attempt.runId,
    thinking: attempt.thinking,
    fields: attempt.fields,
  };
}

export async function recordProjectPhaseRun({
  projectId,
  projectTitle,
  phaseId,
  phaseTitle,
  userAgent,
  phasePatch,
  run,
}: RecordProjectPhaseRunInput): Promise<{
  attempt: ProjectPhaseRunAttempt;
  project: Project | null;
  phase: ProjectPhase | null;
}> {
  const timestamp = run.timestamp || new Date().toISOString();
  const attempt: ProjectPhaseRunAttempt = {
    id: run.id || buildRunId(),
    projectId,
    projectTitle,
    phaseId,
    phaseTitle,
    userAgent,
    kind: run.kind,
    intent: run.intent,
    action: run.action,
    timestamp,
    runStatus: run.runStatus,
    executionMode: run.executionMode,
    deliverable: run.deliverable,
    text: run.text,
    agentId: run.agentId,
    agentName: run.agentName,
    model: run.model,
    sessionId: run.sessionId,
    runId: run.runId,
    thinking: run.thinking,
    fields: run.fields || null,
  };

  const attempts = await getProjectPhaseRuns();
  attempts.unshift(attempt);
  await saveProjectPhaseRuns(attempts);

  const projects = await getProjects();
  const projectIndex = projects.findIndex((entry) => entry.id === projectId);
  if (projectIndex === -1) {
    return { attempt, project: null, phase: null };
  }

  const currentProject = projects[projectIndex];
  const phaseIndex = currentProject.phases.findIndex((entry) => entry.id === phaseId);
  if (phaseIndex === -1) {
    return { attempt, project: currentProject, phase: null };
  }

  const updatedPhases = currentProject.phases.map((phase) =>
    phase.id === phaseId
      ? {
          ...phase,
          ...phasePatch,
          latestRun: toPhaseLatestRun(attempt),
        }
      : phase
  );

  const updatedProject = normalizeProject({
    ...currentProject,
    phases: updatedPhases,
    updatedAgo: "just now",
    updatedBy: attempt.agentName || currentProject.updatedBy || "Mission Control",
  });

  projects[projectIndex] = updatedProject;
  await saveProjects(projects);

  return {
    attempt,
    project: updatedProject,
    phase: updatedProject.phases.find((entry) => entry.id === phaseId) || null,
  };
}
