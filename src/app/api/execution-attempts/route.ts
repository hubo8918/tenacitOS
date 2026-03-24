/**
 * Execution Attempts API
 * Records task-linked execution history and keeps task run metadata in sync.
 * POST /api/execution-attempts
 * GET  /api/execution-attempts?id=<taskId>
 */
import { NextRequest, NextResponse } from "next/server";

import { logActivity } from "@/lib/activities-db";
import { teamAgents } from "@/data/mockTeamData";
import { getAgentTasks, type TaskRunStatus } from "@/lib/agent-tasks-data";
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

    let taskPatch:
      | {
          status?: "pending" | "in_progress" | "completed" | "blocked";
          assigneeAgentId?: string;
          handoffToAgentId?: string;
          agent?: {
            id?: string;
            emoji: string;
            name: string;
            color: string;
          };
        }
      | undefined;
    let reviewRunStatus: TaskRunStatus | undefined = runStatus;
    let reviewDeliverable = deliverable;
    let reviewText: string | undefined;
    let reviewFields:
      | {
          status?: string;
          decision?: string;
          handoffTo?: string;
          needsFromHuman?: string;
        }
      | undefined;
    let taskTitle: string | undefined;

    if (decision) {
      const tasks = await getAgentTasks();
      const task = tasks.find((entry) => entry.id === taskId) || null;
      if (!task) {
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      }

      taskTitle = task.title;

      const decisionLabel =
        decision === "approve"
          ? "APPROVED"
          : decision === "rework"
          ? "CHANGES_REQUESTED"
          : "BLOCKED";
      const handoffTargetId =
        (typeof body.handoffTo === "string" && body.handoffTo.trim()) || task.handoffToAgentId || "";
      const handoffAgent = handoffTargetId
        ? teamAgents.find((agent) => agent.id === handoffTargetId) || null
        : null;

      taskPatch =
        decision === "approve"
          ? handoffTargetId && handoffTargetId !== task.assigneeAgentId
            ? {
                status: "pending",
                assigneeAgentId: handoffTargetId,
                handoffToAgentId: undefined,
                agent: handoffAgent
                  ? {
                      id: handoffAgent.id,
                      emoji: handoffAgent.emoji,
                      name: handoffAgent.name,
                      color: handoffAgent.color,
                    }
                  : undefined,
              }
            : {
                status: "completed",
              }
          : decision === "rework"
          ? {
              status: "in_progress",
            }
          : {
              status: "blocked",
            };

      reviewRunStatus =
        decision === "approve" ? "done" : decision === "rework" ? "running" : "failed";
      reviewText = note || undefined;
      reviewFields = {
        status:
          decision === "approve"
            ? "Approved"
            : decision === "rework"
            ? "Needs rework"
            : "Blocked",
        decision: decisionLabel,
        handoffTo: handoffAgent?.name || handoffTargetId || undefined,
        needsFromHuman: note || undefined,
      };
      reviewDeliverable = [
        `Decision: ${decisionLabel}`,
        decision === "approve"
          ? taskPatch.assigneeAgentId
            ? `Next owner: ${handoffAgent?.name || taskPatch.assigneeAgentId}`
            : "Task marked complete"
          : null,
        note ? `Note: ${note}` : null,
      ]
        .filter((entry): entry is string => Boolean(entry))
        .join(" | ");
    }

    const { attempt, task } = await recordTaskRun({
      taskId,
      taskTitle,
      userAgent: request.headers.get("user-agent") || undefined,
      taskPatch,
      run: {
        kind: "manual",
        intent,
        timestamp: new Date().toISOString(),
        runStatus: reviewRunStatus || deriveManualRunStatus(intent),
        executionMode: executionMode || "manual",
        deliverable: reviewDeliverable,
        text: reviewText,
        fields: reviewFields,
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
