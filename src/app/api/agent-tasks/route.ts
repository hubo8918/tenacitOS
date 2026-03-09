import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getAgentTasks, type AgentTask } from '@/lib/agent-tasks-data';

const DATA_PATH = path.join(process.cwd(), 'data', 'agent-tasks.json');

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
  const nums = tasks.map((t) => parseInt(t.id.replace('task-', ''), 10)).filter((n) => !isNaN(n));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `task-${String(next).padStart(3, '0')}`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const agent = searchParams.get('agent');

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
    console.error('Failed to get agent tasks:', error);
    return NextResponse.json({ error: 'Failed to get agent tasks' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.title) {
      return NextResponse.json(
        { error: 'Missing required field: title' },
        { status: 400 }
      );
    }

    const tasks = await getAgentTasks();

    const newTask: AgentTask = {
      id: generateId(tasks),
      title: body.title,
      status: body.status || 'pending',
      priority: body.priority || 'medium',
      agent: body.agent || { emoji: '👤', name: 'Unassigned', color: '#8E8E93' },
      project: body.project || '',
      dueDate: body.dueDate || '',
    };

    tasks.push(newTask);
    await saveTasks(tasks);

    return NextResponse.json(newTask, { status: 201 });
  } catch (error) {
    console.error('Failed to create agent task:', error);
    return NextResponse.json({ error: 'Failed to create agent task' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json(
        { error: 'Missing required field: id' },
        { status: 400 }
      );
    }

    const tasks = await getAgentTasks();
    const task = tasks.find((t) => t.id === body.id);

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    if (body.title !== undefined) task.title = body.title;
    if (body.status !== undefined) task.status = body.status;
    if (body.priority !== undefined) task.priority = body.priority;
    if (body.agent !== undefined) task.agent = body.agent;
    if (body.project !== undefined) task.project = body.project;
    if (body.dueDate !== undefined) task.dueDate = body.dueDate;

    await saveTasks(tasks);

    return NextResponse.json(task);
  } catch (error) {
    console.error('Failed to update agent task:', error);
    return NextResponse.json({ error: 'Failed to update agent task' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing required query param: id' }, { status: 400 });
    }

    const tasks = await getAgentTasks();
    const index = tasks.findIndex((t) => t.id === id);

    if (index === -1) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    tasks.splice(index, 1);
    await saveTasks(tasks);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete agent task:', error);
    return NextResponse.json({ error: 'Failed to delete agent task' }, { status: 500 });
  }
}
