import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { getAgentTasks, normalizeAgentTask, type AgentTask } from "@/lib/agent-tasks-data";

const DATA_PATH = path.join(process.cwd(), "data", "agent-tasks.json");

async function saveTasks(tasks: AgentTask[]): Promise<void> {
  const dir = path.dirname(DATA_PATH);
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
  await fs.writeFile(DATA_PATH, JSON.stringify(tasks, null, 2));
}

function generateId(tasks: AgentTask[]): string {
  const nums = tasks.map((t) => parseInt(t.id.replace("task-", ""), 10)).filter((n) => !isNaN(n));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `task-${String(next).padStart(3, "0")}`;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getBlockedByTaskIds(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
}

function taskDependsOn(taskId: string, targetTaskId: string, tasksById: Map<string, AgentTask>, visited = new Set<string>()): boolean {
  if (taskId === targetTaskId) return true;
  if (visited.has(taskId)) return false;

  visited.add(taskId);
  const task = tasksById.get(taskId);
  if (!task) return false;

  return task.blockedByTaskIds.some((blockedTaskId) => taskDependsOn(blockedTaskId, targetTaskId, tasksById, visited));
}

function getTaskRoutingValidationError(body: Record<string, unknown>): string | null {
  const assigneeAgentId = asOptionalString(body.assigneeAgentId);
  const reviewerAgentId = asOptionalString(body.reviewerAgentId);
  const handoffToAgentId = asOptionalString(body.handoffToAgentId);
  const blockedByTaskIds = getBlockedByTaskIds(body.blockedByTaskIds);

  if (assigneeAgentId && reviewerAgentId && assigneeAgentId === reviewerAgentId) {
    return "Reviewer must be different from the owner.";
  }

  if (assigneeAgentId && handoffToAgentId && assigneeAgentId === handoffToAgentId) {
    return "Handoff target must be different from the owner.";
  }

  if (typeof body.id === "string" && blockedByTaskIds.includes(body.id)) {
    return "A task cannot depend on itself.";
  }

  return null;
}

function getTaskDependencyValidationError(body: Record<string, unknown>, tasks: AgentTask[]): string | null {
  if (typeof body.id !== "string") {
    return null;
  }

  const blockedByTaskIds = getBlockedByTaskIds(body.blockedByTaskIds);
  if (blockedByTaskIds.length === 0) {
    return null;
  }

  const tasksById = new Map(tasks.map((task) => [task.id, task]));

  for (const blockedTaskId of blockedByTaskIds) {
    if (!tasksById.has(blockedTaskId)) {
      return `Blocking task \"${blockedTaskId}\" was not found.`;
    }

    if (taskDependsOn(blockedTaskId, body.id, tasksById)) {
      return "A task cannot depend on a task that already depends on it.";
    }
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const agent = searchParams.get("agent");

    let tasks = await getAgentTasks();

    if (status) {
      tasks = tasks.filter((t) => t.status === status);
    }
    if (priority) {
      tasks = tasks.filter((t) => t.priority === priority);
    }
    if (agent) {
      tasks = tasks.filter((t) => t.agent.name.toLowerCase() === agent.toLowerCase());
    }

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error("Failed to get agent tasks:", error);
    return NextResponse.json({ error: "Failed to get agent tasks" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    if (!body.title) {
      return NextResponse.json({ error: "Missing required field: title" }, { status: 400 });
    }

    const routingValidationError = getTaskRoutingValidationError(body);
    if (routingValidationError) {
      return NextResponse.json({ error: routingValidationError }, { status: 400 });
    }

    const tasks = await getAgentTasks();

    const newTask = normalizeAgentTask({
      id: generateId(tasks),
      title: body.title,
      status: body.status || "pending",
      priority: body.priority || "medium",
      agent: body.agent || { emoji: "👤", name: "Unassigned", color: "#8E8E93" },
      project: body.project || "",
      dueDate: body.dueDate || "",
      assigneeAgentId: body.assigneeAgentId,
      reviewerAgentId: body.reviewerAgentId,
      blockedByTaskIds: body.blockedByTaskIds,
      handoffToAgentId: body.handoffToAgentId,
      executionMode: body.executionMode,
      runStatus: body.runStatus,
      deliverable: body.deliverable,
    });

    tasks.push(newTask);
    await saveTasks(tasks);

    return NextResponse.json(newTask, { status: 201 });
  } catch (error) {
    console.error("Failed to create agent task:", error);
    return NextResponse.json({ error: "Failed to create agent task" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    if (!body.id) {
      return NextResponse.json({ error: "Missing required field: id" }, { status: 400 });
    }

    const routingValidationError = getTaskRoutingValidationError(body);
    if (routingValidationError) {
      return NextResponse.json({ error: routingValidationError }, { status: 400 });
    }

    const tasks = await getAgentTasks();
    const dependencyValidationError = getTaskDependencyValidationError(body, tasks);
    if (dependencyValidationError) {
      return NextResponse.json({ error: dependencyValidationError }, { status: 400 });
    }

    const index = tasks.findIndex((t) => t.id === body.id);

    if (index === -1) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const updatedTask = normalizeAgentTask({
      ...tasks[index],
      ...body,
      agent: body.agent !== undefined ? body.agent : tasks[index].agent,
      blockedByTaskIds: body.blockedByTaskIds !== undefined ? body.blockedByTaskIds : tasks[index].blockedByTaskIds,
    });

    tasks[index] = updatedTask;
    await saveTasks(tasks);

    return NextResponse.json(updatedTask);
  } catch (error) {
    console.error("Failed to update agent task:", error);
    return NextResponse.json({ error: "Failed to update agent task" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing required query param: id" }, { status: 400 });
    }

    const tasks = await getAgentTasks();
    const index = tasks.findIndex((t) => t.id === id);

    if (index === -1) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    tasks.splice(index, 1);
    await saveTasks(tasks);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete agent task:", error);
    return NextResponse.json({ error: "Failed to delete agent task" }, { status: 500 });
  }
}
