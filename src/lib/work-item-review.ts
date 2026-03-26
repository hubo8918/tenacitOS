import { teamAgents } from "@/data/mockTeamData";
import { getAgentTasks, type AgentTask, type TaskRunStatus } from "@/lib/agent-tasks-data";
import { getProjects } from "@/lib/projects-data";
import { recordProjectPhaseRun } from "@/lib/project-phase-runs-data";
import { recordTaskRun } from "@/lib/task-runs-data";

export type ReviewDecisionValue = "approve" | "rework" | "block";

interface ApplyReviewDecisionInput {
  decision: ReviewDecisionValue;
  note?: string;
  handoffTo?: string;
  userAgent?: string;
}

function resolveReviewerSnapshot(reviewerAgentId?: string) {
  if (!reviewerAgentId) {
    return { reviewerAgentId: undefined, reviewerName: undefined };
  }

  const reviewerAgent = teamAgents.find((agent) => agent.id === reviewerAgentId) || null;
  return {
    reviewerAgentId,
    reviewerName: reviewerAgent?.name || reviewerAgentId,
  };
}

function getDecisionLabel(decision: ReviewDecisionValue): string {
  if (decision === "approve") return "APPROVED";
  if (decision === "rework") return "CHANGES_REQUESTED";
  return "BLOCKED";
}

function getReviewRunStatus(decision: ReviewDecisionValue): TaskRunStatus {
  if (decision === "approve") return "done";
  if (decision === "rework") return "running";
  return "failed";
}

function getTaskPatchForDecision(
  task: AgentTask,
  decision: ReviewDecisionValue,
  handoffTargetId: string
) {
  const handoffAgent = handoffTargetId
    ? teamAgents.find((agent) => agent.id === handoffTargetId) || null
    : null;

  if (decision === "approve") {
    if (handoffTargetId && handoffTargetId !== task.assigneeAgentId) {
      return {
        taskPatch: {
          status: "pending" as const,
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
        },
        handoffAgent,
      };
    }

    return {
      taskPatch: {
        status: "completed" as const,
      },
      handoffAgent,
    };
  }

  if (decision === "rework") {
    return {
      taskPatch: {
        status: "in_progress" as const,
      },
      handoffAgent,
    };
  }

  return {
    taskPatch: {
      status: "blocked" as const,
    },
    handoffAgent,
  };
}

export async function applyTaskReviewDecision(
  taskId: string,
  { decision, note, handoffTo, userAgent }: ApplyReviewDecisionInput
) {
  const trimmedNote = note?.trim() || "";
  if ((decision === "rework" || decision === "block") && !trimmedNote) {
    throw new Error(`A ${decision} review decision requires a note.`);
  }

  const tasks = await getAgentTasks();
  const task = tasks.find((entry) => entry.id === taskId) || null;
  if (!task) {
    throw new Error("Task not found");
  }

  const handoffTargetId = (handoffTo || "").trim() || task.handoffToAgentId || "";
  const { taskPatch, handoffAgent } = getTaskPatchForDecision(task, decision, handoffTargetId);
  const decisionLabel = getDecisionLabel(decision);
  const reviewerSnapshot = resolveReviewerSnapshot(task.reviewerAgentId);
  const deliverable = [
    `Decision: ${decisionLabel}`,
    decision === "approve"
      ? taskPatch.assigneeAgentId
        ? `Next owner: ${handoffAgent?.name || taskPatch.assigneeAgentId}`
        : "Task marked complete"
      : null,
    trimmedNote ? `Note: ${trimmedNote}` : null,
  ]
    .filter((entry): entry is string => Boolean(entry))
    .join(" | ");

  return recordTaskRun({
    taskId,
    taskTitle: task.title,
    userAgent,
    taskPatch,
    run: {
      kind: "manual",
      intent: "review",
      action: "review",
      timestamp: new Date().toISOString(),
      runStatus: getReviewRunStatus(decision),
      executionMode: "manual",
      deliverable,
      text: trimmedNote || undefined,
      fields: {
        status:
          decision === "approve"
            ? "Approved"
            : decision === "rework"
            ? "Needs rework"
            : "Blocked",
        decision: decisionLabel,
        handoffTo: handoffAgent?.name || handoffTargetId || undefined,
        needsFromHuman: trimmedNote || undefined,
        reviewerAgentId: reviewerSnapshot.reviewerAgentId,
        reviewerName: reviewerSnapshot.reviewerName,
      },
    },
  });
}

export async function applyProjectPhaseReviewDecision(
  projectId: string,
  phaseId: string,
  { decision, note, handoffTo, userAgent }: ApplyReviewDecisionInput
) {
  const trimmedNote = note?.trim() || "";
  if ((decision === "rework" || decision === "block") && !trimmedNote) {
    throw new Error(`A ${decision} review decision requires a note.`);
  }

  const projects = await getProjects();
  const project = projects.find((entry) => entry.id === projectId) || null;
  if (!project) {
    throw new Error("Project not found");
  }

  const phase = project.phases.find((entry) => entry.id === phaseId) || null;
  if (!phase) {
    throw new Error("Project phase not found");
  }

  const decisionLabel = getDecisionLabel(decision);
  const handoffTargetId = (handoffTo || "").trim() || phase.handoffToAgentId || "";
  const handoffAgent = handoffTargetId
    ? teamAgents.find((agent) => agent.id === handoffTargetId) || null
    : null;
  const reviewerSnapshot = resolveReviewerSnapshot(phase.reviewerAgentId);
  const phasePatch =
    decision === "approve"
      ? handoffTargetId && handoffTargetId !== phase.ownerAgentId
        ? {
            status: "pending" as const,
            ownerAgentId: handoffTargetId,
            handoffToAgentId: undefined,
          }
        : {
            status: "completed" as const,
          }
      : decision === "rework"
      ? {
          status: "in_progress" as const,
        }
      : {
          status: "blocked" as const,
        };

  const deliverable = [
    `Decision: ${decisionLabel}`,
    decision === "approve"
      ? phasePatch.ownerAgentId
        ? `Next owner: ${handoffAgent?.name || phasePatch.ownerAgentId}`
        : "Phase marked complete"
      : null,
    trimmedNote ? `Note: ${trimmedNote}` : null,
  ]
    .filter((entry): entry is string => Boolean(entry))
    .join(" | ");

  return recordProjectPhaseRun({
    projectId: project.id,
    projectTitle: project.title,
    phaseId: phase.id,
    phaseTitle: phase.title,
    userAgent,
    phasePatch,
    run: {
      kind: "manual",
      intent: "review",
      action: "review",
      timestamp: new Date().toISOString(),
      runStatus: getReviewRunStatus(decision),
      executionMode: "manual",
      deliverable,
      text: trimmedNote || undefined,
      fields: {
        status:
          decision === "approve"
            ? "Approved"
            : decision === "rework"
            ? "Needs rework"
            : "Blocked",
        decision: decisionLabel,
        handoffTo: handoffAgent?.name || handoffTargetId || undefined,
        needsFromHuman: trimmedNote || undefined,
        reviewerAgentId: reviewerSnapshot.reviewerAgentId,
        reviewerName: reviewerSnapshot.reviewerName,
      },
    },
  });
}
