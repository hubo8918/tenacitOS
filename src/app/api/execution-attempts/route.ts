/**
 * Execution Attempts API
 * Records manual execution intent for tasks and updates task execution state
 * POST /api/execution-attempts  body: { taskId, intent, runStatus, executionMode, deliverable }
 * Intent options: "start", "review", "debug"
 */
import { NextRequest, NextResponse } from 'next/server';
import { promises as fsPromises } from 'fs';
import path from 'path';
import { logActivity } from '@/lib/activities-db';

const EXECUTION_ATTEMPTS_FILE = path.join(process.cwd(), 'data', 'execution-attempts.json');
const TASKS_FILE = path.join(process.cwd(), 'data', 'tasks.json');

interface ExecutionAttempt {
  id: string;
  taskId: string;
  taskTitle?: string;
  intent: 'start' | 'review' | 'debug';
  timestamp: string;
  userAgent?: string;
}

interface AgentTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  project?: string;
  projectId?: string;
  dueDate: string;
  assigneeAgentId?: string;
  reviewerAgentId?: string;
  handoffToAgentId?: string;
  blockedByTaskIds?: string[];
  agent?: {
    id: string;
    emoji: string;
    name: string;
    color: string;
  };
  // Execution metadata (Phase 5)
  runStatus?: 'idle' | 'queued' | 'running' | 'needs_review' | 'done' | 'failed';
  executionMode?: 'manual' | 'agent-run';
  deliverable?: string;
}

async function getExecutionAttempts(): Promise<ExecutionAttempt[]> {
  try {
    await fsPromises.access(EXECUTION_ATTEMPTS_FILE);
    const content = await fsPromises.readFile(EXECUTION_ATTEMPTS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

async function saveExecutionAttempts(attempts: ExecutionAttempt[]): Promise<void> {
  const dir = path.dirname(EXECUTION_ATTEMPTS_FILE);
  await fsPromises.mkdir(dir, { recursive: true });
  await fsPromises.writeFile(EXECUTION_ATTEMPTS_FILE, JSON.stringify(attempts, null, 2), 'utf-8');
}

async function getAgentTasks(): Promise<AgentTask[]> {
  try {
    await fsPromises.access(TASKS_FILE);
    const content = await fsPromises.readFile(TASKS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

async function saveAgentTasks(tasks: AgentTask[]): Promise<void> {
  const dir = path.dirname(TASKS_FILE);
  await fsPromises.mkdir(dir, { recursive: true });
  await fsPromises.writeFile(TASKS_FILE, JSON.stringify(tasks, null, 2), 'utf-8');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, intent, runStatus, executionMode, deliverable } = body;

    if (!taskId || !intent) {
      return NextResponse.json({ error: 'Missing taskId or intent' }, { status: 400 });
    }

    const validIntents = ['start', 'review', 'debug'];
    if (!validIntents.includes(intent)) {
      return NextResponse.json(
        { error: `Invalid intent. Valid: ${validIntents.join(', ')}` },
        { status: 400 }
      );
    }

    // Extract a reasonable task title from the taskId
    // This is a best-effort attempt - the real title should come from task data
    const taskTitle = `Task ${taskId}`;

    // Determine execution status based on intent
    let newRunStatus: 'idle' | 'queued' | 'running' | 'needs_review' | 'done' | 'failed' = 'idle';
    let newExecutionMode: 'manual' | 'agent-run' = 'manual';

    if (intent === 'start') {
      newRunStatus = 'running';
      newExecutionMode = 'manual';
    } else if (intent === 'review') {
      newRunStatus = 'needs_review';
      newExecutionMode = 'manual';
    } else if (intent === 'debug') {
      newRunStatus = 'needs_review';
      newExecutionMode = 'manual';
    }

    const attempt: ExecutionAttempt = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      taskId,
      taskTitle,
      intent,
      timestamp: new Date().toISOString(),
      userAgent: request.headers.get('user-agent') || undefined,
    };

    const attempts = await getExecutionAttempts();
    attempts.unshift(attempt);
    await saveExecutionAttempts(attempts);

    // Update task's execution metadata
    const tasks = await getAgentTasks();
    const taskIndex = tasks.findIndex((t) => t.id === taskId);

    if (taskIndex !== -1) {
      // Use the intent-determined status if not explicitly provided
      tasks[taskIndex].runStatus = runStatus || newRunStatus;
      tasks[taskIndex].executionMode = executionMode || newExecutionMode;

      // Set deliverable if provided
      if (deliverable) {
        tasks[taskIndex].deliverable = deliverable;
      }

      await saveAgentTasks(tasks);

      logActivity('execution', `Manual execution recorded: ${intent} on "${taskTitle}", runStatus=${tasks[taskIndex].runStatus}`, 'success', {
        metadata: {
          taskId,
          intent,
          runStatus: tasks[taskIndex].runStatus,
          executionMode: tasks[taskIndex].executionMode,
          timestamp: attempt.timestamp,
        },
      });
    } else {
      // Task not found in task file
      logActivity('execution', `Task not found: ${taskId}`, 'warning', {
        metadata: {
          taskId,
          intent,
          timestamp: attempt.timestamp,
        },
      });
    }

    return NextResponse.json({ success: true, attempt });
  } catch (error) {
    console.error('[execution-attempts] Error:', error);
    return NextResponse.json({ error: 'Failed to record execution attempt' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const intent = searchParams.get('intent');

    let attempts = await getExecutionAttempts();

    // Filter by intent if provided
    if (intent && ['start', 'review', 'debug'].includes(intent)) {
      attempts = attempts.filter((a) => a.intent === intent);
    }

    // Sort by timestamp (newest first)
    attempts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({ attempts, count: attempts.length });
  } catch (error) {
    console.error('[execution-attempts] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch execution attempts' }, { status: 500 });
  }
}