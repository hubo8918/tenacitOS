import { NextRequest, NextResponse } from "next/server";

import {
  listMemoryTree,
  readMemoryFile,
  toFileSystemErrorResponse,
  writeMemoryFile,
} from "@/lib/file-system";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspace = searchParams.get("workspace") || "workspace";
    const filePath = searchParams.get("path");

    if (!filePath) {
      const tree = await listMemoryTree(workspace);
      return NextResponse.json(tree);
    }

    const file = await readMemoryFile({ workspace, path: filePath });
    return NextResponse.json(file);
  } catch (error) {
    const normalized = toFileSystemErrorResponse(error, "Failed to read file.");
    console.error("Error reading file:", error);
    return NextResponse.json(
      { error: normalized.error, code: normalized.code },
      { status: normalized.status }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspace = "workspace", path, content } = body as {
      workspace?: string;
      path?: string;
      content?: string;
    };

    if (!path || typeof content !== "string") {
      return NextResponse.json(
        { error: "Missing path or content.", code: "invalid_path" },
        { status: 400 }
      );
    }

    const result = await writeMemoryFile({ workspace, path, content });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const normalized = toFileSystemErrorResponse(error, "Failed to save file.");
    console.error("Error saving file:", error);
    return NextResponse.json(
      { error: normalized.error, code: normalized.code },
      { status: normalized.status }
    );
  }
}
