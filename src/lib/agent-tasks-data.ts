import fs from "fs/promises";
import path from "path";
import { tasks as seededTasks } from "@/data/mockTasksData";
import { teamAgents } from "@/data/mockTeamData";
import { getProjects } from "@/lib/projects-data";
import { resolveProjectIdFromTaskProjectLabel } from "@/lib/project-task-linkage";

export type AgentTaskStatus = "pending" | "in_progress" | "completed" | "blocked";
export type AgentTaskPriority = "high" | "medium" | "low";
export type TaskExecutionMode = "manual" | "agent-run";
export type TaskRunStatus = "idle" | "queued" | "running" | "needs_review" | "done" | "failed";
export type TaskRunKind = "manual" | "agent_packet";
export type TaskRunIntent = "start" | "review" | "debug" | "agent_check_in" | "agent_wake";

export interface TaskAgentRef {
  id?: string;
  emoji: string;
  name: string;
  color: string;
}

export interface TaskRunFields {
  status?: string;
  focus?: string;
  next?: string;
  blockers?: string;
  needsFromHuman?: string;
  decision?: string;
  handoffTo?: string;
  reviewerAgentId?: string;
  reviewerName?: string;
}

export interface TaskLatestRun {
  id: string;
  kind: TaskRunKind;
  intent: TaskRunIntent;
  action?: "check-in" | "wake" | "review";
  timestamp: string;
  runStatus?: TaskRunStatus;
  executionMode?: TaskExecutionMode;
  deliverable?: string;
  text?: string;
  agentId?: string;
  agentName?: string;
  model?: string;
  sessionId?: string;
  runId?: string;
  thinking?: string;
  fields?: TaskRunFields | null;
}

export interface AgentTask {
  id: string;
  title: string;
  status: AgentTaskStatus;
  priority: AgentTaskPriority;
  agent: TaskAgentRef;
  project: string;
  projectId?: string;
  dueDate: string;
  assigneeAgentId?: string;
  reviewerAgentId?: string;
  blockedByTaskIds: string[];
  handoffToAgentId?: string;
  executionMode: TaskExecutionMode;
  runStatus: TaskRunStatus;
  deliverable: string;
  latestRun?: TaskLatestRun | null;
}

const DATA_PATH = path.join(process.cwd(), "data", "agent-tasks.json");
const TEAM_BY_ID = new Map(teamAgents.map((agent) => [agent.id, agent]));
const TEAM_BY_NAME = new Map(teamAgents.map((agent) => [agent.name.trim().toLowerCase(), agent]));
const SEEDED_TASKS_BY_ID = new Map(seededTasks.map((task) => [task.id, task]));

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function normalizeStatus(value: unknown): AgentTaskStatus {
  return value === "in_progress" || value === "completed" || value === "blocked" ? value : "pending";
}

function normalizePriority(value: unknown): AgentTaskPriority {
  return value === "high" || value === "low" ? value : "medium";
}

function normalizeExecutionMode(value: unknown): TaskExecutionMode {
  return value === "agent-run" ? "agent-run" : "manual";
}

function normalizeRunStatus(value: unknown): TaskRunStatus {
  return value === "queued" || value === "running" || value === "needs_review" || value === "done" || value === "failed"
    ? value
    : "idle";
}

function normalizeRunStatusOptional(value: unknown): TaskRunStatus | undefined {
  return value === "idle" || value === "queued" || value === "running" || value === "needs_review" || value === "done" || value === "failed"
    ? value
    : undefined;
}

function normalizeRunKind(value: unknown): TaskRunKind {
  return value === "agent_packet" ? "agent_packet" : "manual";
}

function normalizeRunIntent(value: unknown): TaskRunIntent {
  return value === "review" || value === "debug" || value === "agent_check_in" || value === "agent_wake"
    ? value
    : "start";
}

function normalizeRunAction(value: unknown): "check-in" | "wake" | "review" | undefined {
  return value === "check-in" || value === "wake" || value === "review" ? value : undefined;
}

function normalizeRunFields(value: unknown): TaskRunFields | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const fields = value as Record<string, unknown>;
  const normalized: TaskRunFields = {};

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

function normalizeLatestRun(runLike: unknown): TaskLatestRun | null {
  if (!runLike || typeof runLike !== "object" || Array.isArray(runLike)) return null;

  const run = asRecord(runLike);
  const id = asNonEmptyString(run.id);
  const timestamp = asNonEmptyString(run.timestamp);
  if (!id || !timestamp) return null;

  return {
    id,
    kind: normalizeRunKind(run.kind),
    intent: normalizeRunIntent(run.intent),
    action: normalizeRunAction(run.action),
    timestamp,
    runStatus: normalizeRunStatusOptional(run.runStatus),
    executionMode:
      run.executionMode === "manual" || run.executionMode === "agent-run"
        ? run.executionMode
        : undefined,
    deliverable: asString(run.deliverable),
    text: asString(run.text),
    agentId: asString(run.agentId),
    agentName: asString(run.agentName),
    model: asString(run.model),
    sessionId: asString(run.sessionId),
    runId: asString(run.runId),
    thinking: asString(run.thinking),
    fields: normalizeRunFields(run.fields),
  };
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

function normalizeAgent(agentLike: unknown): TaskAgentRef {
  const agent = asRecord(agentLike);
  const canonical = resolveAgentRecord(asString(agent.id), asString(agent.name));
  if (canonical) {
    return {
      id: canonical.id,
      emoji: canonical.emoji,
      name: canonical.name,
      color: canonical.color,
    };
  }

  return {
    id: asString(agent.id),
    emoji: asString(agent.emoji) || "\u{1F464}",
    name: asString(agent.name) || "Unassigned",
    color: asString(agent.color) || "#8E8E93",
  };
}

export function normalizeAgentTask(taskLike: unknown): AgentTask {
  const task = asRecord(taskLike);
  const agent = normalizeAgent(task.agent);

  return {
    id: asString(task.id) || "",
    title: asString(task.title) || "Untitled task",
    status: normalizeStatus(task.status),
    priority: normalizePriority(task.priority),
    agent,
    project: asString(task.project) || "",
    projectId: asString(task.projectId),
    dueDate: asString(task.dueDate) || "",
    assigneeAgentId: asString(task.assigneeAgentId) || agent.id,
    reviewerAgentId: asString(task.reviewerAgentId),
    blockedByTaskIds: asStringArray(task.blockedByTaskIds),
    handoffToAgentId: asString(task.handoffToAgentId),
    executionMode: normalizeExecutionMode(task.executionMode),
    runStatus: normalizeRunStatus(task.runStatus),
    deliverable: asString(task.deliverable) || "",
    latestRun: normalizeLatestRun(task.latestRun),
  };
}

function sameTaskRun(left?: TaskLatestRun | null, right?: TaskLatestRun | null): boolean {
  return JSON.stringify(left || null) === JSON.stringify(right || null);
}

function migrateTask(task: AgentTask): { task: AgentTask; changed: boolean } {
  const seeded = SEEDED_TASKS_BY_ID.get(task.id);
  const assigneeAgentId = task.assigneeAgentId || task.agent.id || seeded?.assigneeAgentId;
  const canonicalAgent = resolveAgentRecord(assigneeAgentId, task.agent.name);
  const agent: TaskAgentRef = canonicalAgent
    ? {
        id: canonicalAgent.id,
        emoji: canonicalAgent.emoji,
        name: canonicalAgent.name,
        color: canonicalAgent.color,
      }
    : task.agent;

  const nextTask: AgentTask = {
    ...task,
    agent,
    assigneeAgentId,
    reviewerAgentId: task.reviewerAgentId || seeded?.reviewerAgentId,
    handoffToAgentId: task.handoffToAgentId || seeded?.handoffToAgentId,
    blockedByTaskIds: task.blockedByTaskIds || [],
    executionMode: task.executionMode || seeded?.executionMode || "manual",
    runStatus:
      task.runStatus !== "idle"
        ? task.runStatus
        : seeded?.runStatus || "idle",
    deliverable: task.deliverable || seeded?.deliverable || "",
    latestRun: task.latestRun || seeded?.latestRun || null,
  };

  const changed =
    nextTask.agent.id !== task.agent.id ||
    nextTask.agent.name !== task.agent.name ||
    nextTask.agent.emoji !== task.agent.emoji ||
    nextTask.agent.color !== task.agent.color ||
    nextTask.assigneeAgentId !== task.assigneeAgentId ||
    nextTask.reviewerAgentId !== task.reviewerAgentId ||
    nextTask.handoffToAgentId !== task.handoffToAgentId ||
    nextTask.executionMode !== task.executionMode ||
    nextTask.runStatus !== task.runStatus ||
    nextTask.deliverable !== task.deliverable ||
    !sameTaskRun(nextTask.latestRun, task.latestRun);

  return { task: nextTask, changed };
}

export async function getAgentTasks(): Promise<AgentTask[]> {
  try {
    const data = await fs.readFile(DATA_PATH, "utf-8");
    const parsed = JSON.parse(data) as unknown;
    const tasks = Array.isArray(parsed) ? parsed.map((task) => normalizeAgentTask(task)) : [];

    const projects = await getProjects().catch(() => []);
    let didMigrate = false;
    let nextTasks = tasks.map((task) => {
      const migrated = migrateTask(task);
      if (migrated.changed) {
        didMigrate = true;
      }
      return migrated.task;
    });

    nextTasks = nextTasks.map((task) => {
      if (task.projectId) {
        return task;
      }

      const resolvedProjectId = resolveProjectIdFromTaskProjectLabel(task.project, projects);
      if (!resolvedProjectId) {
        return task;
      }

      didMigrate = true;
      return {
        ...task,
        projectId: resolvedProjectId,
      };
    });

    if (didMigrate) {
      await saveAgentTasks(nextTasks);
    }

    return nextTasks;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    if (code !== "ENOENT") {
      return [];
    }

    const normalizedSeedTasks = seededTasks.map((task) => normalizeAgentTask(task));
    await saveAgentTasks(normalizedSeedTasks);
    return normalizedSeedTasks;
  }
}

export async function saveAgentTasks(tasks: AgentTask[]): Promise<void> {
  const dir = path.dirname(DATA_PATH);

  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }

  const normalized = tasks.map((task) => migrateTask(normalizeAgentTask(task)).task);
  await fs.writeFile(DATA_PATH, JSON.stringify(normalized, null, 2));
}
