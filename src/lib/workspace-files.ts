import fs from "fs";
import os from "os";
import path from "path";

import { OPENCLAW_DIR, OPENCLAW_WORKSPACE } from "@/lib/paths";

export interface WorkspaceDescriptor {
  id: string;
  name: string;
  emoji: string;
  path: string;
  agentName?: string;
}

export interface ResolvedWorkspacePath {
  workspace: string;
  base: string;
  fullPath: string;
  relativePath: string;
}

interface WorkspaceRegistryEntry {
  id: string;
  base: string;
  descriptor: WorkspaceDescriptor;
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

function titleCase(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function readWorkspaceIdentity(workspacePath: string): { name?: string; emoji?: string } | null {
  const identityPath = path.join(workspacePath, "IDENTITY.md");
  if (!fs.existsSync(identityPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(identityPath, "utf-8");
    const nameMatch = content.match(/- \*\*Name:\*\* (.+)/);
    const emojiMatch = content.match(/- \*\*Emoji:\*\* (.+)/);
    return {
      name: nameMatch?.[1]?.trim() || undefined,
      emoji: emojiMatch?.[1]?.trim().split(" ")[0] || undefined,
    };
  } catch {
    return null;
  }
}

function buildDescriptor(id: string, base: string): WorkspaceDescriptor {
  const identity = readWorkspaceIdentity(base);

  if (id === "workspace") {
    return {
      id,
      name: "Primary Workspace",
      emoji: identity?.emoji || "🦞",
      path: base,
      agentName: identity?.name || "Main Agent",
    };
  }

  if (id === "mission-control") {
    return {
      id,
      name: "Mission Control",
      emoji: identity?.emoji || "🧭",
      path: base,
      agentName: identity?.name || "Mission Control",
    };
  }

  const agentId = id.startsWith("workspace-") ? id.slice("workspace-".length) : id;
  return {
    id,
    name: titleCase(agentId),
    emoji: identity?.emoji || "🤖",
    path: base,
    agentName: identity?.name,
  };
}

function getWorkspaceRegistry(): Map<string, WorkspaceRegistryEntry> {
  const registry = new Map<string, WorkspaceRegistryEntry>();

  if (fs.existsSync(OPENCLAW_WORKSPACE)) {
    registry.set("workspace", {
      id: "workspace",
      base: OPENCLAW_WORKSPACE,
      descriptor: buildDescriptor("workspace", OPENCLAW_WORKSPACE),
    });
  }

  const missionControlWorkspace = path.join(OPENCLAW_WORKSPACE, "mission-control");
  if (fs.existsSync(missionControlWorkspace)) {
    registry.set("mission-control", {
      id: "mission-control",
      base: missionControlWorkspace,
      descriptor: buildDescriptor("mission-control", missionControlWorkspace),
    });
  }

  if (fs.existsSync(OPENCLAW_DIR)) {
    const entries = fs.readdirSync(OPENCLAW_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (!entry.name.startsWith("workspace-")) continue;

      const base = path.join(OPENCLAW_DIR, entry.name);
      registry.set(entry.name, {
        id: entry.name,
        base,
        descriptor: buildDescriptor(entry.name, base),
      });
    }
  }

  return registry;
}

export function listWorkspaceDescriptors(): WorkspaceDescriptor[] {
  return [...getWorkspaceRegistry().values()]
    .map((entry) => entry.descriptor)
    .sort((left, right) => {
      if (left.id === "workspace") return -1;
      if (right.id === "workspace") return 1;
      return left.name.localeCompare(right.name);
    });
}

export function getWorkspaceBase(workspace = "workspace"): { workspace: string; base: string } | null {
  const entry = getWorkspaceRegistry().get(workspace);
  if (!entry) return null;
  return { workspace: entry.id, base: entry.base };
}

export function resolveWorkspaceFilePath(options: {
  workspace?: string | null;
  filePath?: string | null;
}): ResolvedWorkspacePath | null {
  const requestedWorkspace = options.workspace || "workspace";
  const input = typeof options.filePath === "string" ? options.filePath.trim() : "";
  const workspaceEntry = getWorkspaceBase(requestedWorkspace);

  if (!workspaceEntry) return null;

  if (!input) {
    return {
      workspace: workspaceEntry.workspace,
      base: workspaceEntry.base,
      fullPath: workspaceEntry.base,
      relativePath: "",
    };
  }

  const expanded = expandHome(input);

  if (path.isAbsolute(expanded)) {
    const absolutePath = path.normalize(expanded);
    if (!isWithinBase(workspaceEntry.base, absolutePath)) {
      return null;
    }

    return {
      workspace: workspaceEntry.workspace,
      base: workspaceEntry.base,
      fullPath: absolutePath,
      relativePath: path.relative(workspaceEntry.base, absolutePath).split(path.sep).join("/"),
    };
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
