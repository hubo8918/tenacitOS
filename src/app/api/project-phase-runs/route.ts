import { NextRequest, NextResponse } from "next/server";

import { teamAgents } from "@/data/mockTeamData";
import { getProjectPhaseRuns, recordProjectPhaseRun } from "@/lib/project-phase-runs-data";
import { getProjects } from "@/lib/projects-data";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId")?.trim() || "";
    const phaseId = searchParams.get("phaseId")?.trim() || "";
    const intent = searchParams.get("intent")?.trim() || "";

    const runs = await getProjectPhaseRuns({
      projectId: projectId || undefined,
      phaseId: phaseId || undefined,
      intent:
        intent === "start" ||
        intent === "review" ||
        intent === "debug" ||
        intent === "agent_check_in" ||
        intent === "agent_wake"
          ? intent
          : undefined,
    });

    return NextResponse.json({ runs });
  } catch (error) {
    console.error("Failed to load project phase runs:", error);
    return NextResponse.json({ error: "Failed to load project phase runs" }, { status: 500 });
  }
}

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const projectId = asTrimmedString(body.projectId);
    const phaseId = asTrimmedString(body.phaseId);
    const decision = asTrimmedString(body.decision).toLowerCase();
    const note = asTrimmedString(body.note);

    if (!projectId || !phaseId) {
      return NextResponse.json({ error: "Missing required fields: projectId, phaseId" }, { status: 400 });
    }

    if (!["approve", "rework", "block"].includes(decision)) {
      return NextResponse.json({ error: "Invalid decision. Use approve, rework, or block." }, { status: 400 });
    }

    if ((decision === "rework" || decision === "block") && !note) {
      return NextResponse.json(
        { error: `A ${decision} review decision requires a note.` },
        { status: 400 }
      );
    }

    const projects = await getProjects();
    const project = projects.find((entry) => entry.id === projectId) || null;
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const phase = project.phases.find((entry) => entry.id === phaseId) || null;
    if (!phase) {
      return NextResponse.json({ error: "Project phase not found" }, { status: 404 });
    }

    const decisionLabel =
      decision === "approve"
        ? "APPROVED"
        : decision === "rework"
        ? "CHANGES_REQUESTED"
        : "BLOCKED";
    const handoffTargetId = asTrimmedString(body.handoffTo) || phase.handoffToAgentId || "";
    const handoffAgent = handoffTargetId
      ? teamAgents.find((agent) => agent.id === handoffTargetId) || null
      : null;

    const nextPhasePatch =
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

    const summaryParts = [
      `Decision: ${decisionLabel}`,
      decision === "approve"
        ? nextPhasePatch.ownerAgentId
          ? `Next owner: ${handoffAgent?.name || nextPhasePatch.ownerAgentId}`
          : "Phase marked complete"
        : null,
      note ? `Note: ${note}` : null,
    ].filter((entry): entry is string => Boolean(entry));

    const result = await recordProjectPhaseRun({
      projectId: project.id,
      projectTitle: project.title,
      phaseId: phase.id,
      phaseTitle: phase.title,
      userAgent: request.headers.get("user-agent") || undefined,
      phasePatch: nextPhasePatch,
      run: {
        kind: "manual",
        intent: "review",
        action: "review",
        runStatus:
          decision === "approve" ? "done" : decision === "rework" ? "running" : "failed",
        executionMode: "manual",
        deliverable: summaryParts.join(" | "),
        text: note || undefined,
        fields: {
          status: decision === "approve" ? "Approved" : decision === "rework" ? "Needs rework" : "Blocked",
          decision: decisionLabel,
          handoffTo: handoffAgent?.name || handoffTargetId || undefined,
          needsFromHuman: note || undefined,
        },
      },
    });

    return NextResponse.json({
      ok: true,
      attempt: result.attempt,
      project: result.project,
      phase: result.phase,
    });
  } catch (error) {
    console.error("Failed to record project phase review:", error);
    return NextResponse.json({ error: "Failed to record project phase review" }, { status: 500 });
  }
}
