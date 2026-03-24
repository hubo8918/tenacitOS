/**
 * Execution Attempts API
 * Records task-linked execution history and keeps task run metadata in sync.
 * POST /api/execution-attempts
 * GET  /api/execution-attempts?id=<taskId>
 */
import { NextRequest, NextResponse } from "next/server";

import { logActivity } from "@/lib/activities-db";
import {
  getExecutionAttempts,
  recordTaskRun,
  type TaskRunAttempt,
} from "@/lib/task-runs-data";

type ManualIntent = "start" | "review" | "debug";

function deriveManualRunStatus(intent: ManualIntent) {
  if (intent === "start") return "running" as const;
  return "needs_review" as const;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const taskId = typeof body.taskId === "string" ? body.taskId : "";
    const intent = body.intent;
    const runStatus =
      body.runStatus === "idle" ||
      body.runStatus === "queued" ||
      body.runStatus === "running" ||
      body.runStatus === "needs_review" ||
      body.runStatus === "done" ||
      body.runStatus === "failed"
        ? body.runStatus
        : undefined;
    const executionMode =
      body.executionMode === "manual" || body.executionMode === "agent-run"
        ? body.executionMode
        : undefined;
    const deliverable =
      typeof body.deliverable === "string" ? body.deliverable : undefined;

    if (!taskId || (intent !== "start" && intent !== "review" && intent !== "debug")) {
      return NextResponse.json(
        { error: "Missing taskId or invalid manual intent" },
        { status: 400 }
      );
    }

    const { attempt, task } = await recordTaskRun({
      taskId,
      userAgent: request.headers.get("user-agent") || undefined,
      run: {
        kind: "manual",
        intent,
        timestamp: new Date().toISOString(),
        runStatus: runStatus || deriveManualRunStatus(intent),
        executionMode: executionMode || "manual",
        deliverable,
      },
    });

    if (task) {
      logActivity(
        "execution",
        `Manual execution recorded: ${intent} on "${task.title}", runStatus=${task.runStatus}`,
        "success",
        {
          metadata: {
            taskId,
            intent,
            runStatus: task.runStatus,
            executionMode: task.executionMode,
            timestamp: attempt.timestamp,
          },
        }
      );
    } else {
      logActivity("execution", `Task not found for execution attempt: ${taskId}`, "warning", {
        metadata: {
          taskId,
          intent,
          timestamp: attempt.timestamp,
        },
      });
    }

    return NextResponse.json({ success: true, attempt, task });
  } catch (error) {
    console.error("[execution-attempts] Error:", error);
    return NextResponse.json(
      { error: "Failed to record execution attempt" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get("taskId") || searchParams.get("id") || undefined;
    const intentParam = searchParams.get("intent");
    const intent =
      intentParam === "start" ||
      intentParam === "review" ||
      intentParam === "debug" ||
      intentParam === "agent_check_in" ||
      intentParam === "agent_wake"
        ? intentParam
        : undefined;

    const attempts: TaskRunAttempt[] = await getExecutionAttempts({ taskId, intent });
    return NextResponse.json({ attempts, count: attempts.length });
  } catch (error) {
    console.error("[execution-attempts] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch execution attempts" },
      { status: 500 }
    );
  }
}
