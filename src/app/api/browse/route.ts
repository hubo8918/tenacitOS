import path from "path";

import { NextRequest, NextResponse } from "next/server";

import {
  downloadFile,
  listDirectory,
  readFileContent,
  toFileSystemErrorResponse,
} from "@/lib/file-system";

const RAW_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/x-icon",
]);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const workspace = searchParams.get("workspace") || "workspace";
    const requestedPath = searchParams.get("path") || "";
    const fileContent = searchParams.get("content") === "true";
    const rawMode = searchParams.get("raw") === "true";

    if (rawMode) {
      const download = await downloadFile({ workspace, path: requestedPath });
      if (!RAW_IMAGE_TYPES.has(download.mimeType)) {
        return NextResponse.json(
          { error: "Raw mode only supports image files.", code: "invalid_path" },
          { status: 400 }
        );
      }

      return new NextResponse(new Uint8Array(download.content), {
        headers: {
          "Content-Type": download.mimeType,
          "Content-Length": download.size.toString(),
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    if (fileContent) {
      const file = await readFileContent({ workspace, path: requestedPath });
      return NextResponse.json(file);
    }

    if (requestedPath) {
      try {
        const file = await readFileContent({ workspace, path: requestedPath });
        return NextResponse.json({
          name: path.basename(file.path),
          path: file.path,
          workspace: file.workspace,
          type: "file",
          size: file.size,
          modified: file.modified,
        });
      } catch (error) {
        const normalized = toFileSystemErrorResponse(error, "Failed to browse path.");
        if (normalized.code !== "invalid_path") {
          throw error;
        }
      }
    }

    const directory = await listDirectory({ workspace, path: requestedPath });
    return NextResponse.json(directory);
  } catch (error) {
    const normalized = toFileSystemErrorResponse(error, "Failed to browse path.");
    console.error("Browse API error:", error);
    return NextResponse.json(
      { error: normalized.error, code: normalized.code },
      { status: normalized.status }
    );
  }
}
