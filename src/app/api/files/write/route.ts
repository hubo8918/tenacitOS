import { NextRequest, NextResponse } from "next/server";

import { toFileSystemErrorResponse, writeFileContent } from "@/lib/file-system";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspace, path, content } = body as {
      workspace?: string;
      path?: string;
      content?: string;
    };

    if (!path || content === undefined) {
      return NextResponse.json(
        { error: "Missing path or content.", code: "invalid_path" },
        { status: 400 }
      );
    }

    const result = await writeFileContent({
      workspace: workspace || "workspace",
      path,
      content,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const normalized = toFileSystemErrorResponse(error, "Write failed.");
    console.error("[write] Error:", error);
    return NextResponse.json(
      { error: normalized.error, code: normalized.code },
      { status: normalized.status }
    );
  }
}
