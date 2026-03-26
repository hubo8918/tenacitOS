import { NextRequest, NextResponse } from "next/server";

import { getProjectPhaseRuns } from "@/lib/project-phase-runs-data";
import { applyProjectPhaseReviewDecision } from "@/lib/work-item-review";

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
    const decisionValue = asTrimmedString(body.decision).toLowerCase();
    const decision =
      decisionValue === "approve" || decisionValue === "rework" || decisionValue === "block"
        ? decisionValue
        : null;
    const note = asTrimmedString(body.note);

    if (!projectId || !phaseId) {
      return NextResponse.json({ error: "Missing required fields: projectId, phaseId" }, { status: 400 });
    }

    if (!decision) {
      return NextResponse.json({ error: "Invalid decision. Use approve, rework, or block." }, { status: 400 });
    }

    if ((decision === "rework" || decision === "block") && !note) {
      return NextResponse.json(
        { error: `A ${decision} review decision requires a note.` },
        { status: 400 }
      );
    }

    const result = await applyProjectPhaseReviewDecision(projectId, phaseId, {
      decision,
      note,
      handoffTo: asTrimmedString(body.handoffTo) || undefined,
      userAgent: request.headers.get("user-agent") || undefined,
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
