import fs from "fs/promises";
import path from "path";
import type { Project, ProjectPhase } from "@/data/mockProjectsData";

const DATA_PATH = path.join(process.cwd(), "data", "projects.json");

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function normalizeProjectStatus(value: unknown): Project["status"] {
  return value === "active" || value === "paused" || value === "completed" ? value : "planning";
}

function normalizeProjectPriority(value: unknown): Project["priority"] {
  return value === "high" || value === "low" ? value : "medium";
}

function normalizeProjectPhase(phaseLike: unknown): ProjectPhase {
  const phase = asRecord(phaseLike);
  return {
    id: asString(phase.id) || "",
    title: asString(phase.title) || "Untitled phase",
    status:
      phase.status === "in_progress" || phase.status === "blocked" || phase.status === "completed"
        ? phase.status
        : "pending",
    ownerAgentId: asString(phase.ownerAgentId),
    dependsOnPhaseIds: asStringArray(phase.dependsOnPhaseIds),
  };
}

export function normalizeProject(projectLike: unknown): Project {
  const project = asRecord(projectLike);
  const agent = asRecord(project.agent);

  return {
    id: asString(project.id) || "",
    title: asString(project.title) || "Untitled project",
    description: asString(project.description) || "",
    status: normalizeProjectStatus(project.status),
    progress: typeof project.progress === "number" ? project.progress : 0,
    priority: normalizeProjectPriority(project.priority),
    agent: {
      emoji: asString(agent.emoji) || "👤",
      name: asString(agent.name) || "Unassigned",
      color: asString(agent.color) || "#8E8E93",
    },
    updatedAgo: asString(project.updatedAgo) || "just now",
    updatedBy: asString(project.updatedBy) || "",
    ownerAgentId: asString(project.ownerAgentId),
    participatingAgentIds: asStringArray(project.participatingAgentIds),
    phases: Array.isArray(project.phases) ? project.phases.map((phase) => normalizeProjectPhase(phase)) : [],
  };
}

export async function getProjects(): Promise<Project[]> {
  try {
    const data = await fs.readFile(DATA_PATH, "utf-8");
    const parsed = JSON.parse(data) as unknown;
    return Array.isArray(parsed) ? parsed.map((project) => normalizeProject(project)) : [];
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

export async function saveProjects(projects: Project[]): Promise<void> {
  const dir = path.dirname(DATA_PATH);

  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }

  await fs.writeFile(DATA_PATH, JSON.stringify(projects, null, 2));
}
