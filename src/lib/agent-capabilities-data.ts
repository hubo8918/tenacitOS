import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

const DATA_PATH = path.join(process.cwd(), "data", "agent-capabilities.json");
const AGENT_ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

export interface AgentCapabilityOverlay {
  id: string;
  canLead?: boolean;
  canReview?: boolean;
  canExecute?: boolean;
  workTypes?: string[];
}

export interface AgentCapabilityProfile {
  canLead: boolean;
  canReview: boolean;
  canExecute: boolean;
  workTypes: string[];
  configured: boolean;
}

function normalizeWorkTypes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const workTypes: string[] = [];

  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim();
    if (!trimmed) continue;

    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    workTypes.push(trimmed);
  }

  return workTypes;
}

function parseOverlayEntry(value: unknown): AgentCapabilityOverlay | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;

  if (typeof record.id !== "string" || !AGENT_ID_RE.test(record.id)) {
    return null;
  }

  const entry: AgentCapabilityOverlay = {
    id: record.id,
  };

  if (typeof record.canLead === "boolean") entry.canLead = record.canLead;
  if (typeof record.canReview === "boolean") entry.canReview = record.canReview;
  if (typeof record.canExecute === "boolean") entry.canExecute = record.canExecute;

  const workTypes = normalizeWorkTypes(record.workTypes);
  if (workTypes.length > 0) {
    entry.workTypes = workTypes;
  }

  return entry;
}

export function sanitizeAgentCapabilityId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return AGENT_ID_RE.test(value) ? value : null;
}

export function loadAgentCapabilityOverlay(): AgentCapabilityOverlay[] {
  if (!existsSync(DATA_PATH)) return [];

  try {
    const parsed = JSON.parse(readFileSync(DATA_PATH, "utf-8"));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(parseOverlayEntry)
      .filter((entry): entry is AgentCapabilityOverlay => Boolean(entry));
  } catch {
    return [];
  }
}

export function saveAgentCapabilityOverlay(entries: AgentCapabilityOverlay[]): void {
  mkdirSync(path.dirname(DATA_PATH), { recursive: true });
  writeFileSync(DATA_PATH, JSON.stringify(entries, null, 2));
}

export function buildAgentCapabilityProfile(
  overlay?: AgentCapabilityOverlay | null
): AgentCapabilityProfile {
  const workTypes = normalizeWorkTypes(overlay?.workTypes);
  const configured = Boolean(
    overlay &&
      (typeof overlay.canLead === "boolean" ||
        typeof overlay.canReview === "boolean" ||
        typeof overlay.canExecute === "boolean" ||
        workTypes.length > 0)
  );

  return {
    canLead: overlay?.canLead === true,
    canReview: overlay?.canReview === true,
    canExecute: overlay?.canExecute === true,
    workTypes,
    configured,
  };
}
