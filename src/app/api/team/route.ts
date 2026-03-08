import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { spawnSync } from "child_process";

const DATA_PATH = path.join(process.cwd(), "data", "team.json");
const ACTIVE_WINDOW_MS = 15 * 60 * 1000;
const AGENT_ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

type TeamStatus = "online" | "offline";
type TeamTier = "leadership" | "operations" | "io" | "meta";

interface TeamTag {
  label: string;
  color: string;
}

interface TeamOverlay {
  id: string;
  name?: string;
  role?: string;
  emoji?: string;
  color?: string;
  description?: string;
  tags?: TeamTag[];
  status?: TeamStatus;
  tier?: TeamTier;
  specialBadge?: string;
}

interface TeamAgent {
  id: string;
  name: string;
  role: string;
  emoji: string;
  color: string;
  description: string;
  tags: TeamTag[];
  status: TeamStatus;
  tier: TeamTier;
  specialBadge?: string;
  activeSessions: number;
  lastActiveAt: string | null;
}

interface OpenClawAgent {
  id: string;
  name?: string;
  identityName?: string;
  identityEmoji?: string;
  workspace?: string;
}

interface OpenClawSessionsPayload {
  sessions?: Array<{
    agentId?: string;
    updatedAt?: number;
  }>;
}

const OPENCLAW_CMD = "openclaw";
const OPENCLAW_POWERSHELL_SCRIPT =
  process.platform === "win32" && process.env.APPDATA
    ? path.join(process.env.APPDATA, "npm", "openclaw.ps1")
    : null;

function runOpenClaw(args: string[]): string {
  const execOptions = {
    encoding: "utf-8" as BufferEncoding,
    timeout: 15000,
    windowsHide: true,
  };

  let result = null as ReturnType<typeof spawnSync> | null;

  if (OPENCLAW_POWERSHELL_SCRIPT) {
    result = spawnSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        OPENCLAW_POWERSHELL_SCRIPT,
        ...args,
      ],
      execOptions
    );
  }

  if (!result || result.error?.message?.includes("ENOENT")) {
    result = spawnSync(OPENCLAW_CMD, args, {
      ...execOptions,
      shell: process.platform === "win32",
    });
  }

  if (result.error) {
    throw result.error;
  }

  const stdoutText =
    typeof result.stdout === "string"
      ? result.stdout
      : result.stdout
      ? result.stdout.toString("utf-8")
      : "";
  const stderrText =
    typeof result.stderr === "string"
      ? result.stderr
      : result.stderr
      ? result.stderr.toString("utf-8")
      : "";

  if (result.status !== 0) {
    throw new Error((stderrText || stdoutText || "openclaw command failed").trim());
  }

  return stdoutText.trim();
}

function normalizeTier(value: unknown): TeamTier {
  if (
    value === "leadership" ||
    value === "operations" ||
    value === "io" ||
    value === "meta"
  ) {
    return value;
  }
  return "io";
}

function normalizeStatus(value: unknown): TeamStatus | null {
  if (value === "online" || value === "offline") return value;
  return null;
}

function normalizeTags(value: unknown): TeamTag[] {
  if (!Array.isArray(value)) return [];

  const tags: TeamTag[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    if (typeof record.label !== "string" || typeof record.color !== "string") {
      continue;
    }
    tags.push({ label: record.label, color: record.color });
  }

  return tags;
}

function parseOverlayEntry(value: unknown): TeamOverlay | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;

  if (typeof record.id !== "string") return null;

  const entry: TeamOverlay = {
    id: record.id,
  };

  if (typeof record.name === "string") entry.name = record.name;
  if (typeof record.role === "string") entry.role = record.role;
  if (typeof record.emoji === "string") entry.emoji = record.emoji;
  if (typeof record.color === "string") entry.color = record.color;
  if (typeof record.description === "string") entry.description = record.description;

  const status = normalizeStatus(record.status);
  if (status) entry.status = status;

  entry.tier = normalizeTier(record.tier);

  const tags = normalizeTags(record.tags);
  if (tags.length > 0) entry.tags = tags;

  if (typeof record.specialBadge === "string") {
    entry.specialBadge = record.specialBadge;
  }

  return entry;
}

async function loadTeamOverlay(): Promise<TeamOverlay[]> {
  try {
    const data = await fs.readFile(DATA_PATH, "utf-8");
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map(parseOverlayEntry)
      .filter((item): item is TeamOverlay => Boolean(item));
  } catch {
    return [];
  }
}

async function saveTeamOverlay(team: TeamOverlay[]): Promise<void> {
  await fs.writeFile(DATA_PATH, JSON.stringify(team, null, 2));
}

function listOpenClawAgents(): OpenClawAgent[] {
  const output = runOpenClaw(["agents", "list", "--json"]);
  const parsed = JSON.parse(output);

  if (!Array.isArray(parsed)) return [];

  return parsed.filter((entry): entry is OpenClawAgent => {
    return Boolean(
      entry &&
        typeof entry === "object" &&
        typeof (entry as { id?: unknown }).id === "string"
    );
  });
}

function listOpenClawSessions(): OpenClawSessionsPayload {
  try {
    const output = runOpenClaw(["sessions", "--all-agents", "--json"]);
    const parsed = JSON.parse(output);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as OpenClawSessionsPayload;
  } catch {
    return {};
  }
}

interface AgentSessionStats {
  activeSessions: number;
  lastActiveAt: string | null;
}

function buildSessionStatsMap(payload: OpenClawSessionsPayload): Map<string, AgentSessionStats> {
  const sessions = Array.isArray(payload.sessions) ? payload.sessions : [];
  const map = new Map<string, AgentSessionStats>();
  const now = Date.now();

  for (const session of sessions) {
    if (!session || typeof session !== "object") continue;
    const agentId = session.agentId;
    const updatedAt = session.updatedAt;

    if (typeof agentId !== "string" || typeof updatedAt !== "number") continue;

    const stats = map.get(agentId) || { activeSessions: 0, lastActiveAt: null };

    if (!stats.lastActiveAt || updatedAt > Date.parse(stats.lastActiveAt)) {
      stats.lastActiveAt = new Date(updatedAt).toISOString();
    }

    if (now - updatedAt <= ACTIVE_WINDOW_MS) {
      stats.activeSessions += 1;
    }

    map.set(agentId, stats);
  }

  return map;
}

function mergeTeamAgent(
  overlay: TeamOverlay | undefined,
  realAgent: OpenClawAgent,
  sessionStats: AgentSessionStats
): TeamAgent {
  const fallbackTags: TeamTag[] = [{ label: "Local", color: "#30D158" }];

  return {
    id: realAgent.id,
    name:
      overlay?.name?.trim() ||
      realAgent.identityName ||
      realAgent.name ||
      realAgent.id,
    role: overlay?.role?.trim() || "OpenClaw Agent",
    emoji: overlay?.emoji || realAgent.identityEmoji || "🤖",
    color: overlay?.color || "#8E8E93",
    description:
      overlay?.description?.trim() ||
      "Local OpenClaw agent connected to Mission Control.",
    tags: overlay?.tags && overlay.tags.length > 0 ? overlay.tags : fallbackTags,
    status:
      sessionStats.activeSessions > 0
        ? "online"
        : normalizeStatus(overlay?.status) || "offline",
    tier: normalizeTier(overlay?.tier),
    specialBadge: overlay?.specialBadge,
    activeSessions: sessionStats.activeSessions,
    lastActiveAt: sessionStats.lastActiveAt,
  };
}

function defaultWorkspaceFor(agentId: string): string {
  const home = process.env.USERPROFILE || process.env.HOME || process.cwd();
  return path.join(home, ".openclaw", `workspace-${agentId}`);
}

function sanitizeAgentId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!AGENT_ID_RE.test(value)) return null;
  return value;
}

function coerceString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function syncAgentIdentity(realAgent: OpenClawAgent, name?: string, emoji?: string): void {
  const identityName = name || realAgent.identityName || realAgent.name || realAgent.id;
  const workspace = realAgent.workspace || defaultWorkspaceFor(realAgent.id);

  const args = [
    "agents",
    "set-identity",
    "--agent",
    realAgent.id,
    "--workspace",
    workspace,
    "--name",
    identityName,
    "--json",
  ];

  if (emoji) {
    args.push("--emoji", emoji);
  }

  runOpenClaw(args);
}

async function buildMergedTeam(): Promise<TeamAgent[]> {
  const overlay = await loadTeamOverlay();
  const overlayMap = new Map(overlay.map((item) => [item.id, item]));

  const realAgents = listOpenClawAgents().filter((agent) => agent.id !== "main");
  const sessionStatsMap = buildSessionStatsMap(listOpenClawSessions());

  const merged: TeamAgent[] = [];

  // Keep existing card order from overlay for UX consistency.
  for (const entry of overlay) {
    const real = realAgents.find((agent) => agent.id === entry.id);
    if (!real) continue;

    merged.push(
      mergeTeamAgent(
        entry,
        real,
        sessionStatsMap.get(entry.id) || { activeSessions: 0, lastActiveAt: null }
      )
    );
  }

  // Include real agents that exist locally but are not yet in overlay.
  for (const real of realAgents) {
    if (overlayMap.has(real.id)) continue;
    merged.push(
      mergeTeamAgent(
        undefined,
        real,
        sessionStatsMap.get(real.id) || { activeSessions: 0, lastActiveAt: null }
      )
    );
  }

  return merged;
}

// GET — list all team members, optional ?tier= filter
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tierParam = searchParams.get("tier");

    const team = await buildMergedTeam();

    if (!tierParam) {
      return NextResponse.json({ team });
    }

    const tier = normalizeTier(tierParam);
    return NextResponse.json({ team: team.filter((agent) => agent.tier === tier) });
  } catch {
    return NextResponse.json({ error: "Failed to load team" }, { status: 500 });
  }
}

// POST — add new team member (creates local OpenClaw agent + overlay metadata)
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const id = sanitizeAgentId(body.id);
    const name = coerceString(body.name);
    const role = coerceString(body.role);

    if (!id || !name || !role) {
      return NextResponse.json(
        { error: "Missing required fields: id, name, role (id must be [a-z0-9_-])" },
        { status: 400 }
      );
    }

    const overlays = await loadTeamOverlay();
    if (overlays.some((entry) => entry.id === id)) {
      return NextResponse.json({ error: "Agent with this ID already exists in team overlay" }, { status: 409 });
    }

    const realAgents = listOpenClawAgents();
    let real = realAgents.find((agent) => agent.id === id);

    if (!real) {
      const workspace = defaultWorkspaceFor(id);
      runOpenClaw(["agents", "add", id, "--workspace", workspace, "--non-interactive", "--json"]);

      const emoji = coerceString(body.emoji);
      const identityArgs = [
        "agents",
        "set-identity",
        "--agent",
        id,
        "--workspace",
        workspace,
        "--name",
        name,
        "--json",
      ];

      if (emoji) {
        identityArgs.push("--emoji", emoji);
      }

      runOpenClaw(identityArgs);

      real = { id, identityName: name, identityEmoji: emoji, workspace };
    }

    const newOverlay: TeamOverlay = {
      id,
      name,
      role,
      emoji: coerceString(body.emoji),
      color: coerceString(body.color) || "#8E8E93",
      description: coerceString(body.description) || "",
      tags: normalizeTags(body.tags),
      status: normalizeStatus(body.status) || "offline",
      tier: normalizeTier(body.tier),
      specialBadge: coerceString(body.specialBadge),
    };

    overlays.push(newOverlay);
    await saveTeamOverlay(overlays);

    const sessionStatsMap = buildSessionStatsMap(listOpenClawSessions());
    return NextResponse.json(
      mergeTeamAgent(
        newOverlay,
        real,
        sessionStatsMap.get(id) || { activeSessions: 0, lastActiveAt: null }
      ),
      {
        status: 201,
      }
    );
  } catch {
    return NextResponse.json({ error: "Failed to create agent" }, { status: 500 });
  }
}

// PUT — update existing team member
export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const id = sanitizeAgentId(body.id);

    if (!id) {
      return NextResponse.json({ error: "Missing or invalid id" }, { status: 400 });
    }

    const overlays = await loadTeamOverlay();
    const index = overlays.findIndex((entry) => entry.id === id);

    if (index === -1) {
      return NextResponse.json({ error: "Agent not found in team overlay" }, { status: 404 });
    }

    const realAgents = listOpenClawAgents();
    const real = realAgents.find((agent) => agent.id === id);

    if (!real) {
      return NextResponse.json({ error: "Agent not found in OpenClaw" }, { status: 404 });
    }

    const requestedName = coerceString(body.name);
    const requestedEmoji = coerceString(body.emoji);

    const nextOverlay: TeamOverlay = {
      ...overlays[index],
      name: requestedName ?? overlays[index].name,
      role: coerceString(body.role) ?? overlays[index].role,
      emoji: requestedEmoji ?? overlays[index].emoji,
      color: coerceString(body.color) ?? overlays[index].color,
      description: coerceString(body.description) ?? overlays[index].description,
      specialBadge: coerceString(body.specialBadge) ?? overlays[index].specialBadge,
      tier: body.tier ? normalizeTier(body.tier) : overlays[index].tier,
      status: normalizeStatus(body.status) ?? overlays[index].status,
      tags: body.tags ? normalizeTags(body.tags) : overlays[index].tags,
    };

    const shouldSyncIdentity = requestedName !== undefined || requestedEmoji !== undefined;
    if (shouldSyncIdentity) {
      syncAgentIdentity(real, nextOverlay.name, nextOverlay.emoji);
    }

    overlays[index] = nextOverlay;
    await saveTeamOverlay(overlays);

    const sessionStatsMap = buildSessionStatsMap(listOpenClawSessions());
    return NextResponse.json(
      mergeTeamAgent(
        nextOverlay,
        real,
        sessionStatsMap.get(id) || { activeSessions: 0, lastActiveAt: null }
      )
    );
  } catch {
    return NextResponse.json({ error: "Failed to update agent" }, { status: 500 });
  }
}

// DELETE — remove team member and local OpenClaw agent
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = sanitizeAgentId(searchParams.get("id"));

    if (!id) {
      return NextResponse.json({ error: "Missing or invalid id" }, { status: 400 });
    }

    if (id === "main") {
      return NextResponse.json({ error: "Cannot delete main agent" }, { status: 400 });
    }

    const overlays = await loadTeamOverlay();
    const next = overlays.filter((entry) => entry.id !== id);
    await saveTeamOverlay(next);

    const realAgents = listOpenClawAgents();
    if (realAgents.some((agent) => agent.id === id)) {
      runOpenClaw(["agents", "delete", id, "--force", "--json"]);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete agent" }, { status: 500 });
  }
}
