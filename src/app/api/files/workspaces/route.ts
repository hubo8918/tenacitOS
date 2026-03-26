import { NextResponse } from "next/server";

import { listWorkspaces, toFileSystemErrorResponse } from "@/lib/file-system";

export async function GET() {
  try {
    return NextResponse.json({ workspaces: listWorkspaces() });
  } catch (error) {
    const normalized = toFileSystemErrorResponse(error, "Failed to list workspaces.");
    console.error("[workspaces] Error:", error);
    return NextResponse.json(
      { workspaces: [], error: normalized.error, code: normalized.code },
      { status: normalized.status }
    );
  }
}
