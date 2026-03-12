import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { logActivity } from "@/lib/activities-db";
import { getWorkspaceBase, resolveWorkspaceFilePath } from "@/lib/workspace-files";

function getUploadFailureMessage(error: unknown): string {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;

  switch (code) {
    case "EACCES":
    case "EPERM":
      return "Upload failed: Mission Control cannot write to that folder.";
    case "ENOTDIR":
      return "Upload failed: target path is not a folder.";
    case "ENOENT":
      return "Upload failed: target folder no longer exists.";
    default:
      return "Upload failed";
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const workspace = (formData.get("workspace") as string) || "workspace";
    const dirPath = (formData.get("path") as string) || "";
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const workspaceEntry = getWorkspaceBase(workspace);
    if (!workspaceEntry) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const resolvedDir = dirPath
      ? resolveWorkspaceFilePath({ workspace, filePath: dirPath })
      : {
          workspace: workspaceEntry.workspace,
          base: workspaceEntry.base,
          fullPath: workspaceEntry.base,
          relativePath: "",
        };

    if (!resolvedDir) {
      return NextResponse.json(
        { error: "Invalid upload path. Path must stay inside a known workspace." },
        { status: 400 }
      );
    }

    try {
      const stats = await fs.stat(resolvedDir.fullPath);
      if (!stats.isDirectory()) {
        return NextResponse.json({ error: "Upload target must be a folder." }, { status: 400 });
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") {
        throw error;
      }
      await fs.mkdir(resolvedDir.fullPath, { recursive: true });
    }

    const results: Array<{ name: string; size: number; path: string }> = [];

    for (const file of files) {
      const sanitizedName = path.basename(file.name);
      if (!sanitizedName) {
        return NextResponse.json({ error: "Upload failed: one of the files has no name." }, { status: 400 });
      }

      const targetPath = path.join(resolvedDir.fullPath, sanitizedName);
      const buffer = Buffer.from(await file.arrayBuffer());
      await fs.writeFile(targetPath, buffer);

      results.push({
        name: sanitizedName,
        size: buffer.length,
        path: resolvedDir.relativePath ? `${resolvedDir.relativePath}/${sanitizedName}` : sanitizedName,
      });
    }

    logActivity(
      "file_write",
      `Uploaded ${results.length} file(s) to ${resolvedDir.workspace}/${resolvedDir.relativePath || "/"}`,
      "success",
      {
        metadata: { files: results.map((result) => result.name), workspace: resolvedDir.workspace, dirPath: resolvedDir.relativePath },
      }
    );

    return NextResponse.json({ success: true, files: results });
  } catch (error) {
    console.error("[upload] Error:", error);
    return NextResponse.json({ error: getUploadFailureMessage(error) }, { status: 500 });
  }
}
