import { NextResponse } from "next/server";
import { getAgentsSummary } from "@/lib/agents-data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const agents = await getAgentsSummary();
    return NextResponse.json({ agents });
  } catch (error) {
    console.error("Error reading agents:", error);
    return NextResponse.json({ error: "Failed to load agents" }, { status: 500 });
  }
}
