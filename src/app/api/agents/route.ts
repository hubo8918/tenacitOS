import { NextRequest, NextResponse } from "next/server";
import {
  getAgentsSummary,
  invalidateAgentsCache,
} from "@/lib/agents-data";
import {
  loadAgentCapabilityOverlay,
  saveAgentCapabilityOverlay,
  sanitizeAgentCapabilityId,
} from "@/lib/agent-capabilities-data";

export const dynamic = "force-dynamic";

function normalizeWorkTypes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const workTypes: string[] = [];

  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim();
    if (!trimmed) continue;

    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    workTypes.push(trimmed);
  }

  return workTypes;
}

export async function GET() {
  try {
    const agents = await getAgentsSummary();
    return NextResponse.json({ agents });
  } catch (error) {
    console.error("Error reading agents:", error);
    return NextResponse.json({ error: "Failed to load agents" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const id = sanitizeAgentCapabilityId(body.id);

    if (!id) {
      return NextResponse.json({ error: "Missing or invalid id" }, { status: 400 });
    }

    const agents = await getAgentsSummary();
    if (!agents.some((agent) => agent.id === id)) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const overlays = loadAgentCapabilityOverlay();
    const index = overlays.findIndex((entry) => entry.id === id);
    const existing = index >= 0 ? overlays[index] : { id };

    const nextOverlay = {
      ...existing,
      canLead: body.canLead === true,
      canReview: body.canReview === true,
      canExecute: body.canExecute === true,
      workTypes: normalizeWorkTypes(body.workTypes),
    };

    if (index >= 0) {
      overlays[index] = nextOverlay;
    } else {
      overlays.push(nextOverlay);
    }

    saveAgentCapabilityOverlay(overlays);
    invalidateAgentsCache();

    const updatedAgents = await getAgentsSummary();
    const updated = updatedAgents.find((agent) => agent.id === id);

    return NextResponse.json({ agent: updated });
  } catch (error) {
    console.error("Error updating agent capability profile:", error);
    return NextResponse.json({ error: "Failed to update agent" }, { status: 500 });
  }
}
