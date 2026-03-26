import { NextRequest, NextResponse } from "next/server";

import { applyProjectPhaseReviewDecision, applyTaskReviewDecision } from "@/lib/work-item-review";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const kind = typeof body.kind === "string" ? body.kind : "";
    const itemId = typeof body.itemId === "string" ? body.itemId.trim() : "";
    const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
    const decision =
      body.decision === "approve" || body.decision === "rework" || body.decision === "block"
        ? body.decision
        : null;
    const note = typeof body.note === "string" ? body.note : undefined;
    const handoffTo = typeof body.handoffTo === "string" ? body.handoffTo : undefined;
    const userAgent = request.headers.get("user-agent") || undefined;

    if (!decision) {
      return NextResponse.json({ error: "Invalid review decision" }, { status: 400 });
    }

    if (kind === "task" && itemId) {
      const result = await applyTaskReviewDecision(itemId, {
        decision,
        note,
        handoffTo,
        userAgent,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    if (kind === "phase" && itemId && projectId) {
      const result = await applyProjectPhaseReviewDecision(projectId, itemId, {
        decision,
        note,
        handoffTo,
        userAgent,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ error: "Missing kind, itemId, or projectId" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to record review decision";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
