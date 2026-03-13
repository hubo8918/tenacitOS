import fs from "fs/promises";
import path from "path";
import { getProjects } from "@/lib/projects-data";
import { resolveProjectIdFromTaskProjectLabel } from "@/lib/project-task-linkage";

export type AgentTaskStatus = "pending" | "in_progress" | "completed" | "blocked";
export type AgentTaskPriority = "high" | "medium" | "low";
export type TaskExecutionMode = "manual" | "agent-run";
export type TaskRunStatus = "idle" | "queued" | "running" | "needs_review" | "done" | "failed";

export interface TaskAgentRef {
  id?: string;
  emoji: string;
  name: string;
  color: string;
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
}

const DATA_PATH = path.join(process.cwd(), "data", "agent-tasks.json");

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

function normalizeAgent(agentLike: unknown): TaskAgentRef {
  const agent = asRecord(agentLike);
  return {
    id: asString(agent.id),
    emoji: asString(agent.emoji) || "👤",
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
  };
}

export async function getAgentTasks(): Promise<AgentTask[]> {
  try {
    const data = await fs.readFile(DATA_PATH, "utf-8");
    const parsed = JSON.parse(data) as unknown;
    const tasks = Array.isArray(parsed) ? parsed.map((task) => normalizeAgentTask(task)) : [];

    const projects = await getProjects().catch(() => []);
    let didBackfillProjectIds = false;
    const nextTasks = tasks.map((task) => {
      if (task.projectId) {
        return task;
      }

      const resolvedProjectId = resolveProjectIdFromTaskProjectLabel(task.project, projects);
      if (!resolvedProjectId) {
        return task;
      }

      didBackfillProjectIds = true;
      return {
        ...task,
        projectId: resolvedProjectId,
      };
    });

    if (didBackfillProjectIds) {
      await saveAgentTasks(nextTasks);
    }

    return nextTasks;
  } catch {
    return [];
  }
}

export async function saveAgentTasks(tasks: AgentTask[]): Promise<void> {
  const dir = path.dirname(DATA_PATH);

  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }

  await fs.writeFile(DATA_PATH, JSON.stringify(tasks, null, 2));
}
