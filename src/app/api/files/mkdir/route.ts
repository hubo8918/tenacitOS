import { NextRequest, NextResponse } from "next/server";

import { createDirectory, toFileSystemErrorResponse } from "@/lib/file-system";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspace, path, name } = body as {
      workspace?: string;
      path?: string;
      name?: string;
    };

    if (!path && !name) {
      return NextResponse.json(
        { error: "Missing path or name.", code: "invalid_path" },
        { status: 400 }
      );
    }

    const result = await createDirectory({
      workspace: workspace || "workspace",
      path,
      name,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const normalized = toFileSystemErrorResponse(error, "Failed to create directory.");
    console.error("[mkdir] Error:", error);
    return NextResponse.json(
      { error: normalized.error, code: normalized.code },
      { status: normalized.status }
    );
  }
}
