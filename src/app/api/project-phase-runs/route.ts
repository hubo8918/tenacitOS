import { NextRequest, NextResponse } from "next/server";

import { getProjectPhaseRuns } from "@/lib/project-phase-runs-data";

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
