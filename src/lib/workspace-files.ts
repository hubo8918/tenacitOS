import os from "os";
import path from "path";

import { OPENCLAW_DIR } from "@/lib/paths";

export const WORKSPACE_MAP: Record<string, string> = {
  workspace: path.join(OPENCLAW_DIR, "workspace"),
  "mission-control": path.join(OPENCLAW_DIR, "workspace", "mission-control"),
};

export interface ResolvedWorkspaceFilePath {
  workspace: string;
  base: string;
  fullPath: string;
  relativePath: string;
}

function expandHome(filePath: string): string {
  if (filePath === "~") return os.homedir();
  if (filePath.startsWith("~/") || filePath.startsWith("~\\")) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  return filePath;
}

function isWithinBase(base: string, candidate: string): boolean {
  const relative = path.relative(base, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function normalizeRelativePath(filePath: string): string {
  const normalized = filePath.replace(/[\\/]+/g, path.sep);
  return normalized === path.sep ? "" : normalized;
}

export function getWorkspaceBase(workspace = "workspace"): { workspace: string; base: string } | null {
  const base = WORKSPACE_MAP[workspace];
  if (!base) return null;
  return { workspace, base };
}

export function resolveWorkspaceFilePath(options: {
  workspace?: string | null;
  filePath?: string | null;
}): ResolvedWorkspaceFilePath | null {
  const requestedWorkspace = options.workspace || "workspace";
  const input = typeof options.filePath === "string" ? options.filePath.trim() : "";
  const workspaceEntry = getWorkspaceBase(requestedWorkspace);

  if (!workspaceEntry || !input) return null;

  const expanded = expandHome(input);

  if (path.isAbsolute(expanded)) {
    const absolutePath = path.normalize(expanded);

    for (const [workspace, base] of Object.entries(WORKSPACE_MAP)) {
      if (!isWithinBase(base, absolutePath)) continue;
      return {
        workspace,
        base,
        fullPath: absolutePath,
        relativePath: path.relative(base, absolutePath).split(path.sep).join("/"),
      };
    }

    return null;
  }

  const base = workspaceEntry.base;
  const fullPath = path.resolve(base, normalizeRelativePath(expanded));
  if (!isWithinBase(base, fullPath)) {
    return null;
  }

  return {
    workspace: workspaceEntry.workspace,
    base,
    fullPath,
    relativePath: path.relative(base, fullPath).split(path.sep).join("/"),
  };
}
