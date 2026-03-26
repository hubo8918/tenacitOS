import { NextRequest, NextResponse } from "next/server";

import { toFileSystemErrorResponse, uploadFiles } from "@/lib/file-system";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const workspace = (formData.get("workspace") as string) || "workspace";
    const dirPath = (formData.get("path") as string) || "";
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "No files provided.", code: "invalid_path" },
        { status: 400 }
      );
    }

    const result = await uploadFiles({
      workspace,
      path: dirPath,
      files,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const normalized = toFileSystemErrorResponse(error, "Upload failed.");
    console.error("[upload] Error:", error);
    return NextResponse.json(
      { error: normalized.error, code: normalized.code },
      { status: normalized.status }
    );
  }
}
