import { NextRequest, NextResponse } from "next/server";

import { deleteEntry, toFileSystemErrorResponse } from "@/lib/file-system";

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspace, path } = body as {
      workspace?: string;
      path?: string;
    };

    if (!path) {
      return NextResponse.json(
        { error: "Missing path.", code: "invalid_path" },
        { status: 400 }
      );
    }

    const result = await deleteEntry({
      workspace: workspace || "workspace",
      path,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const normalized = toFileSystemErrorResponse(error, "Delete failed.");
    console.error("[delete] Error:", error);
    return NextResponse.json(
      { error: normalized.error, code: normalized.code },
      { status: normalized.status }
    );
  }
}
