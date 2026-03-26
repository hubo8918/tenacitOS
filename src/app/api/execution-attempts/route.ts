/**
 * Execution Attempts API
 * Records task-linked execution history and keeps task run metadata in sync.
 * POST /api/execution-attempts
 * GET  /api/execution-attempts?id=<taskId>
 */
import { NextRequest, NextResponse } from "next/server";

import { logActivity } from "@/lib/activities-db";
import { type TaskRunStatus } from "@/lib/agent-tasks-data";
import {
  getExecutionAttempts,
  recordTaskRun,
  type TaskRunAttempt,
} from "@/lib/task-runs-data";
import { applyTaskReviewDecision } from "@/lib/work-item-review";

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
    const decision =
      body.decision === "approve" || body.decision === "rework" || body.decision === "block"
        ? body.decision
        : undefined;
    const note = typeof body.note === "string" ? body.note.trim() : "";
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

    if (decision && intent !== "review") {
      return NextResponse.json(
        { error: "Manual review decisions require review intent" },
        { status: 400 }
      );
    }

    if ((decision === "rework" || decision === "block") && !note) {
      return NextResponse.json(
        { error: `A ${decision} review decision requires a note.` },
        { status: 400 }
      );
    }

    const reviewRunStatus: TaskRunStatus | undefined = runStatus;
    const reviewDeliverable = deliverable;
    const reviewText: string | undefined = undefined;

    if (decision) {
      const result = await applyTaskReviewDecision(taskId, {
        decision,
        note,
        handoffTo: typeof body.handoffTo === "string" ? body.handoffTo : undefined,
        userAgent: request.headers.get("user-agent") || undefined,
      });

      if (result.task) {
        logActivity(
          "execution",
          `Manual review recorded: ${decision} on "${result.task.title}", runStatus=${result.task.runStatus}`,
          "success",
          {
            metadata: {
              taskId,
              intent,
              decision,
              runStatus: result.task.runStatus,
              executionMode: result.task.executionMode,
              timestamp: result.attempt.timestamp,
            },
          }
        );
      }

      return NextResponse.json({ success: true, ...result });
    }

    const { attempt, task } = await recordTaskRun({
      taskId,
      userAgent: request.headers.get("user-agent") || undefined,
      run: {
        kind: "manual",
        intent,
        timestamp: new Date().toISOString(),
        runStatus: reviewRunStatus || deriveManualRunStatus(intent),
        executionMode: executionMode || "manual",
        deliverable: reviewDeliverable,
        text: reviewText,
      },
    });

    if (task) {
      logActivity(
        "execution",
        decision
          ? `Manual review recorded: ${decision} on "${task.title}", runStatus=${task.runStatus}`
          : `Manual execution recorded: ${intent} on "${task.title}", runStatus=${task.runStatus}`,
        "success",
        {
          metadata: {
            taskId,
            intent,
            decision,
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
