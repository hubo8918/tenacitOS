import fs from "fs/promises";
import path from "path";

import {
  getAgentTasks,
  normalizeAgentTask,
  saveAgentTasks,
  type AgentTask,
  type TaskAgentRef,
  type TaskExecutionMode,
  type TaskLatestRun,
  type TaskRunIntent,
  type TaskRunStatus,
} from "@/lib/agent-tasks-data";

const EXECUTION_ATTEMPTS_FILE = path.join(process.cwd(), "data", "execution-attempts.json");

export interface TaskRunAttempt extends TaskLatestRun {
  taskId: string;
  taskTitle?: string;
  userAgent?: string;
}

interface RecordTaskRunInput {
  taskId: string;
  taskTitle?: string;
  userAgent?: string;
  taskPatch?: Partial<
    Pick<
      AgentTask,
      "status" | "assigneeAgentId" | "reviewerAgentId" | "handoffToAgentId" | "agent"
    >
  >;
  run: Omit<TaskLatestRun, "id" | "timestamp"> &
    Partial<Pick<TaskLatestRun, "id" | "timestamp">>;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function normalizeRunStatus(value: unknown): TaskRunStatus | undefined {
  return value === "idle" ||
    value === "queued" ||
    value === "running" ||
    value === "needs_review" ||
    value === "done" ||
    value === "failed"
    ? value
    : undefined;
}

function normalizeExecutionMode(value: unknown): TaskExecutionMode | undefined {
  return value === "manual" || value === "agent-run" ? value : undefined;
}

function normalizeIntent(value: unknown): TaskRunIntent {
  return value === "review" || value === "debug" || value === "agent_check_in" || value === "agent_wake"
    ? value
    : "start";
}

function normalizeAction(value: unknown): "check-in" | "wake" | "review" | undefined {
  return value === "check-in" || value === "wake" || value === "review" ? value : undefined;
}

function normalizeFields(value: unknown): TaskLatestRun["fields"] {
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
    reviewerAgentId: asString(fields.reviewerAgentId),
    reviewerName: asString(fields.reviewerName),
    managerAction: asString(fields.managerAction),
    mutationSummary: asString(fields.mutationSummary),
    createdTasks: asString(fields.createdTasks),
    updatedTasks: asString(fields.updatedTasks),
    phaseUpdate: asString(fields.phaseUpdate),
    projectProgress: asString(fields.projectProgress),
  };

  return Object.values(normalized).some(Boolean) ? normalized : null;
}

function normalizeTaskRunAttempt(runLike: unknown): TaskRunAttempt | null {
  if (!runLike || typeof runLike !== "object" || Array.isArray(runLike)) return null;

  const run = asRecord(runLike);
  const id = asString(run.id);
  const taskId = asString(run.taskId);
  const timestamp = asString(run.timestamp);
  if (!id || !taskId || !timestamp) return null;

  return {
    id,
    taskId,
    taskTitle: asString(run.taskTitle),
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

async function saveExecutionAttempts(attempts: TaskRunAttempt[]): Promise<void> {
  const dir = path.dirname(EXECUTION_ATTEMPTS_FILE);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(EXECUTION_ATTEMPTS_FILE, JSON.stringify(attempts, null, 2), "utf-8");
}

export async function getExecutionAttempts(filters?: {
  taskId?: string;
  intent?: TaskRunIntent;
}): Promise<TaskRunAttempt[]> {
  try {
    const content = await fs.readFile(EXECUTION_ATTEMPTS_FILE, "utf-8");
    const parsed = JSON.parse(content) as unknown;
    const attempts = Array.isArray(parsed)
      ? parsed
          .map((entry) => normalizeTaskRunAttempt(entry))
          .filter((entry): entry is TaskRunAttempt => Boolean(entry))
      : [];

    return attempts
      .filter((attempt) => !filters?.taskId || attempt.taskId === filters.taskId)
      .filter((attempt) => !filters?.intent || attempt.intent === filters.intent)
      .sort(
        (left, right) =>
          new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()
      );
  } catch {
    return [];
  }
}

function toTaskLatestRun(attempt: TaskRunAttempt): TaskLatestRun {
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

export async function recordTaskRun({
  taskId,
  taskTitle,
  userAgent,
  taskPatch,
  run,
}: RecordTaskRunInput): Promise<{ attempt: TaskRunAttempt; task: AgentTask | null }> {
  const timestamp = run.timestamp || new Date().toISOString();
  const attempt: TaskRunAttempt = {
    id: run.id || buildRunId(),
    taskId,
    taskTitle,
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

  const attempts = await getExecutionAttempts();
  attempts.unshift(attempt);
  await saveExecutionAttempts(attempts);

  const tasks = await getAgentTasks();
  const taskIndex = tasks.findIndex((entry) => entry.id === taskId);
  if (taskIndex === -1) {
    return { attempt, task: null };
  }

  const currentTask = tasks[taskIndex];
  const nextAgent = taskPatch?.agent as TaskAgentRef | undefined;
  const updatedTask = normalizeAgentTask({
    ...currentTask,
    ...taskPatch,
    agent: nextAgent || currentTask.agent,
    runStatus: run.runStatus ?? currentTask.runStatus,
    executionMode: run.executionMode ?? currentTask.executionMode,
    deliverable: run.deliverable ?? currentTask.deliverable,
    latestRun: toTaskLatestRun(attempt),
  });

  tasks[taskIndex] = updatedTask;
  await saveAgentTasks(tasks);

  return { attempt, task: updatedTask };
}
