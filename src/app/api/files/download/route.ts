import { NextRequest, NextResponse } from "next/server";

import { downloadFile, toFileSystemErrorResponse } from "@/lib/file-system";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspace = searchParams.get("workspace") || "workspace";
    const filePath = searchParams.get("path") || "";

    if (!filePath) {
      return NextResponse.json(
        { error: "Missing path parameter.", code: "invalid_path" },
        { status: 400 }
      );
    }

    const download = await downloadFile({ workspace, path: filePath });
    return new NextResponse(new Uint8Array(download.content), {
      headers: {
        "Content-Type": download.mimeType,
        "Content-Disposition": `attachment; filename="${download.filename}"`,
        "Content-Length": download.size.toString(),
      },
    });
  } catch (error) {
    const normalized = toFileSystemErrorResponse(error, "Download failed.");
    console.error("[download] Error:", error);
    return NextResponse.json(
      { error: normalized.error, code: normalized.code },
      { status: normalized.status }
    );
  }
}
