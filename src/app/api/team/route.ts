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
  model: string;
  workspace: string;
  identitySource?: string;
}

interface OpenClawAgent {
  id: string;
  name?: string;
  identityName?: string;
  identityEmoji?: string;
  identitySource?: string;
  workspace?: string;
  model?: string;
}

interface OpenClawSessionsPayload {
  sessions?: Array<{
    agentId?: string;
    updatedAt?: number;
  }>;
}

interface TeamBuildTrace {
  overlayMs: number;
  agentsMs: number;
  sessionsMs: number;
  mergeMs: number;
  totalMs: number;
  overlayCount: number;
  realAgentCount: number;
  sessionCount: number;
  fallbackOverlayOnly: boolean;
  agentsSource: "cli" | "cache" | "stale-cache" | "none";
  sessionsSource: "cli" | "cache" | "stale-cache" | "none";
  agentsCacheAgeMs: number | null;
  sessionsCacheAgeMs: number | null;
}

interface TeamBuildResult {
  team: TeamAgent[];
  trace: TeamBuildTrace;
}

interface TeamCacheEntry {
  team: TeamAgent[];
  updatedAt: number;
}

interface TimedCache<T> {
  value: T;
  updatedAt: number;
}

interface CachedLoadResult<T> {
  value: T;
  source: "cli" | "cache" | "stale-cache" | "none";
  cacheAgeMs: number | null;
}

const DEFAULT_TEAM_CACHE_TTL_MS = 15_000;
const DEFAULT_AGENTS_CACHE_TTL_MS = 120_000;
const DEFAULT_SESSIONS_CACHE_TTL_MS = 45_000;
const DEFAULT_TEAM_TRACE_SLOW_MS = 6_000;

function readEnvMs(name: string, fallbackMs: number): number {
  const raw = process.env[name];
  if (!raw) return fallbackMs;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallbackMs;
  }

  return parsed;
}

const TEAM_CACHE_TTL_MS = readEnvMs("MC_TEAM_CACHE_TTL_MS", DEFAULT_TEAM_CACHE_TTL_MS);
const AGENTS_CACHE_TTL_MS = readEnvMs("MC_TEAM_AGENTS_CACHE_TTL_MS", DEFAULT_AGENTS_CACHE_TTL_MS);
const SESSIONS_CACHE_TTL_MS = readEnvMs(
  "MC_TEAM_SESSIONS_CACHE_TTL_MS",
  DEFAULT_SESSIONS_CACHE_TTL_MS
);
const TEAM_TRACE_SLOW_MS = readEnvMs("MC_TEAM_TRACE_SLOW_MS", DEFAULT_TEAM_TRACE_SLOW_MS);

let teamCache: TeamCacheEntry | null = null;
let agentsCache: TimedCache<OpenClawAgent[]> | null = null;
let sessionsCache: TimedCache<OpenClawSessionsPayload> | null = null;
let teamRefreshInFlight: Promise<TeamBuildResult> | null = null;

const OPENCLAW_CMD = "openclaw";
const OPENCLAW_POWERSHELL_SCRIPT =
  process.platform === "win32" && process.env.APPDATA
    ? path.join(process.env.APPDATA, "npm", "openclaw.ps1")
    : null;

function logTeamTrace(event: string, payload: object): void {
  const withTotal = payload as { totalMs?: unknown };
  const totalMs = typeof withTotal.totalMs === "number" ? withTotal.totalMs : null;
  const shouldLog =
    process.env.MC_TEAM_TRACE === "1" ||
    process.env.NODE_ENV !== "production" ||
    (typeof totalMs === "number" && totalMs >= TEAM_TRACE_SLOW_MS);

  if (!shouldLog) return;

  console.info(`[team-api] ${event} ${JSON.stringify(payload)}`);
}

function runOpenClaw(args: string[], timeoutMs = 12000): string {
  const execOptions = {
    encoding: "utf-8" as BufferEncoding,
    timeout: timeoutMs,
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
  const output = runOpenClaw(["agents", "list", "--json"], 7000);
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
  const output = runOpenClaw(["sessions", "--all-agents", "--json"], 5000);
  const parsed = JSON.parse(output);
  if (!parsed || typeof parsed !== "object") return {};
  return parsed as OpenClawSessionsPayload;
}

function cloneOpenClawAgents(agents: OpenClawAgent[]): OpenClawAgent[] {
  return agents.map((agent) => ({ ...agent }));
}

function cloneOpenClawSessions(payload: OpenClawSessionsPayload): OpenClawSessionsPayload {
  const sessions = Array.isArray(payload.sessions)
    ? payload.sessions.map((session) => ({ ...session }))
    : [];

  return { sessions };
}

function loadAgentsWithCache(): CachedLoadResult<OpenClawAgent[]> {
  const now = Date.now();

  if (agentsCache) {
    const ageMs = now - agentsCache.updatedAt;
    if (ageMs <= AGENTS_CACHE_TTL_MS) {
      return {
        value: cloneOpenClawAgents(agentsCache.value),
        source: "cache",
        cacheAgeMs: ageMs,
      };
    }
  }

  try {
    const fresh = listOpenClawAgents().filter((agent) => agent.id !== "main");
    agentsCache = {
      value: cloneOpenClawAgents(fresh),
      updatedAt: now,
    };

    return {
      value: fresh,
      source: "cli",
      cacheAgeMs: 0,
    };
  } catch {
    if (agentsCache) {
      return {
        value: cloneOpenClawAgents(agentsCache.value),
        source: "stale-cache",
        cacheAgeMs: now - agentsCache.updatedAt,
      };
    }

    return {
      value: [],
      source: "none",
      cacheAgeMs: null,
    };
  }
}

function loadSessionsWithCache(): CachedLoadResult<OpenClawSessionsPayload> {
  const now = Date.now();

  if (sessionsCache) {
    const ageMs = now - sessionsCache.updatedAt;
    if (ageMs <= SESSIONS_CACHE_TTL_MS) {
      return {
        value: cloneOpenClawSessions(sessionsCache.value),
        source: "cache",
        cacheAgeMs: ageMs,
      };
    }
  }

  try {
    const fresh = listOpenClawSessions();
    sessionsCache = {
      value: cloneOpenClawSessions(fresh),
      updatedAt: now,
    };

    return {
      value: fresh,
      source: "cli",
      cacheAgeMs: 0,
    };
  } catch {
    if (sessionsCache) {
      return {
        value: cloneOpenClawSessions(sessionsCache.value),
        source: "stale-cache",
        cacheAgeMs: now - sessionsCache.updatedAt,
      };
    }

    return {
      value: { sessions: [] },
      source: "none",
      cacheAgeMs: null,
    };
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
    status: sessionStats.activeSessions > 0 ? "online" : "offline",
    tier: normalizeTier(overlay?.tier),
    specialBadge: overlay?.specialBadge,
    activeSessions: sessionStats.activeSessions,
    lastActiveAt: sessionStats.lastActiveAt,
    model: realAgent.model || "unknown",
    workspace: realAgent.workspace || defaultWorkspaceFor(realAgent.id),
    identitySource: realAgent.identitySource,
  };
}

function fallbackFromOverlay(overlay: TeamOverlay): TeamAgent {
  return {
    id: overlay.id,
    name: overlay.name?.trim() || overlay.id,
    role: overlay.role?.trim() || "OpenClaw Agent",
    emoji: overlay.emoji || "🤖",
    color: overlay.color || "#8E8E93",
    description: overlay.description?.trim() || "Local OpenClaw agent profile.",
    tags:
      overlay.tags && overlay.tags.length > 0
        ? overlay.tags
        : [{ label: "Local", color: "#30D158" }],
    status: normalizeStatus(overlay.status) || "offline",
    tier: normalizeTier(overlay.tier),
    specialBadge: overlay.specialBadge,
    activeSessions: 0,
    lastActiveAt: null,
    model: "unknown",
    workspace: defaultWorkspaceFor(overlay.id),
    identitySource: "overlay",
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

async function buildMergedTeam(): Promise<TeamBuildResult> {
  const totalStart = Date.now();

  const overlayStart = Date.now();
  const overlay = await loadTeamOverlay();
  const overlayMs = Date.now() - overlayStart;
  const overlayMap = new Map(overlay.map((item) => [item.id, item]));

  const agentsStart = Date.now();
  const agentsLoad = loadAgentsWithCache();
  const realAgents = agentsLoad.value;
  const agentsMs = Date.now() - agentsStart;

  const sessionsStart = Date.now();
  const sessionsLoad = loadSessionsWithCache();
  const sessionsPayload = sessionsLoad.value;
  const sessionsMs = Date.now() - sessionsStart;
  const sessionCount = Array.isArray(sessionsPayload.sessions)
    ? sessionsPayload.sessions.length
    : 0;
  const sessionStatsMap = buildSessionStatsMap(sessionsPayload);

  const mergeStart = Date.now();
  let fallbackOverlayOnly = false;
  const merged: TeamAgent[] = [];

  if (realAgents.length === 0 && overlay.length > 0) {
    fallbackOverlayOnly = true;
    merged.push(...overlay.map(fallbackFromOverlay));
  } else {
    // Keep existing card order from overlay for UX consistency.
    for (const entry of overlay) {
      const real = realAgents.find((agent) => agent.id === entry.id);
      if (!real) {
        merged.push(fallbackFromOverlay(entry));
        continue;
      }

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
  }

  const mergeMs = Date.now() - mergeStart;
  const totalMs = Date.now() - totalStart;

  const trace: TeamBuildTrace = {
    overlayMs,
    agentsMs,
    sessionsMs,
    mergeMs,
    totalMs,
    overlayCount: overlay.length,
    realAgentCount: realAgents.length,
    sessionCount,
    fallbackOverlayOnly,
    agentsSource: agentsLoad.source,
    sessionsSource: sessionsLoad.source,
    agentsCacheAgeMs: agentsLoad.cacheAgeMs,
    sessionsCacheAgeMs: sessionsLoad.cacheAgeMs,
  };

  const degraded =
    agentsLoad.source === "stale-cache" ||
    agentsLoad.source === "none" ||
    sessionsLoad.source === "stale-cache" ||
    sessionsLoad.source === "none";

  logTeamTrace(degraded ? "build.completed_degraded" : "build.completed", trace);

  return { team: merged, trace };
}

function cloneTeam(team: TeamAgent[]): TeamAgent[] {
  return team.map((agent) => ({
    ...agent,
    tags: agent.tags.map((tag) => ({ ...tag })),
  }));
}

function getFreshTeamCache(): TeamAgent[] | null {
  if (!teamCache) return null;
  if (Date.now() - teamCache.updatedAt > TEAM_CACHE_TTL_MS) return null;
  return cloneTeam(teamCache.team);
}

function setTeamCache(team: TeamAgent[]): void {
  teamCache = {
    team: cloneTeam(team),
    updatedAt: Date.now(),
  };
}

function invalidateTeamCache(): void {
  teamCache = null;
  agentsCache = null;
  sessionsCache = null;
  teamRefreshInFlight = null;
}

async function refreshTeamCache(): Promise<TeamBuildResult> {
  if (teamRefreshInFlight) {
    return teamRefreshInFlight;
  }

  teamRefreshInFlight = (async () => {
    const next = await buildMergedTeam();
    setTeamCache(next.team);
    return next;
  })().finally(() => {
    teamRefreshInFlight = null;
  });

  return teamRefreshInFlight;
}

async function resolveTeamForGet(): Promise<TeamAgent[]> {
  const cached = getFreshTeamCache();
  if (cached) {
    return cached;
  }

  try {
    const refreshed = await refreshTeamCache();
    return cloneTeam(refreshed.team);
  } catch {
    if (teamCache?.team) {
      const ageMs = Date.now() - teamCache.updatedAt;
      logTeamTrace("build.failed_using_stale_cache", { ageMs });
      return cloneTeam(teamCache.team);
    }

    const overlay = await loadTeamOverlay();
    if (overlay.length > 0) {
      logTeamTrace("build.failed_using_overlay", { overlayCount: overlay.length });
      return overlay.map(fallbackFromOverlay);
    }

    logTeamTrace("build.failed_empty", {});
    return [];
  }
}

// GET — list all team members, optional ?tier= filter
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tierParam = searchParams.get("tier");

    const team = await resolveTeamForGet();

    if (!tierParam) {
      return NextResponse.json({ team });
    }

    const tier = normalizeTier(tierParam);
    return NextResponse.json({ team: team.filter((agent) => agent.tier === tier) });
  } catch {
    return NextResponse.json({ team: [] });
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
    invalidateTeamCache();

    const sessionStatsMap = buildSessionStatsMap(loadSessionsWithCache().value);
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
      tags: body.tags ? normalizeTags(body.tags) : overlays[index].tags,
    };

    const shouldSyncIdentity = requestedName !== undefined || requestedEmoji !== undefined;
    if (shouldSyncIdentity) {
      syncAgentIdentity(real, nextOverlay.name, nextOverlay.emoji);
    }

    overlays[index] = nextOverlay;
    await saveTeamOverlay(overlays);
    invalidateTeamCache();

    const sessionStatsMap = buildSessionStatsMap(loadSessionsWithCache().value);
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
    invalidateTeamCache();

    const realAgents = listOpenClawAgents();
    if (realAgents.some((agent) => agent.id === id)) {
      runOpenClaw(["agents", "delete", id, "--force", "--json"]);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete agent" }, { status: 500 });
  }
}
