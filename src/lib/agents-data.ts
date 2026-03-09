import { readFileSync } from "fs";
import { join } from "path";
import { spawnSync } from "child_process";
import { OPENCLAW_DIR, OPENCLAW_CONFIG } from "@/lib/paths";

export interface AgentSummary {
  id: string;
  name?: string;
  emoji: string;
  color: string;
  model: string;
  workspace: string;
  dmPolicy?: string;
  allowAgents?: string[];
  allowAgentsDetails?: Array<{
    id: string;
    name: string;
    emoji: string;
    color: string;
  }>;
  botToken?: string;
  status: "online" | "offline";
  lastActivity?: string;
  activeSessions: number;
}

interface OpenClawAgentConfig {
  id: string;
  name?: string;
  workspace?: string;
  model?: {
    primary?: string;
  };
  subagents?: {
    allowAgents?: string[];
  };
  ui?: {
    emoji?: string;
    color?: string;
  };
}

interface OpenClawConfig {
  agents?: {
    list?: OpenClawAgentConfig[];
    defaults?: {
      workspace?: string;
      model?: {
        primary?: string;
      };
    };
  };
  channels?: {
    telegram?: {
      dmPolicy?: string;
      accounts?: Record<
        string,
        {
          dmPolicy?: string;
          botToken?: string;
        }
      >;
    };
  };
}

interface OpenClawSessionsPayload {
  sessions?: Array<{
    agentId?: string;
    updatedAt?: number;
  }>;
}

interface AgentSessionStats {
  activeSessions: number;
  lastActiveAt: string | undefined;
}

const DEFAULT_AGENT_CONFIG: Record<string, { emoji: string; color: string; name?: string }> = {
  main: {
    emoji: process.env.NEXT_PUBLIC_AGENT_EMOJI || "🤖",
    color: "#ff6b35",
    name: process.env.NEXT_PUBLIC_AGENT_NAME || "Mission Control",
  },
};

interface AgentCacheEntry {
  agents: AgentSummary[];
  updatedAt: number;
}

interface SessionsCacheEntry {
  payload: OpenClawSessionsPayload;
  updatedAt: number;
}

const AGENTS_CACHE_TTL_MS = 30_000;
const SESSIONS_CACHE_TTL_MS = 45_000;
const ACTIVE_WINDOW_MS = 15 * 60 * 1000;
const OPENCLAW_CMD = "openclaw";
const OPENCLAW_POWERSHELL_SCRIPT =
  process.platform === "win32" && process.env.APPDATA
    ? join(process.env.APPDATA, "npm", "openclaw.ps1")
    : null;

let agentsCache: AgentCacheEntry | null = null;
let sessionsCache: SessionsCacheEntry | null = null;

function getAgentDisplayInfo(
  agentId: string,
  agentConfig?: OpenClawAgentConfig | null
): { emoji: string; color: string; name: string } {
  const configEmoji = agentConfig?.ui?.emoji;
  const configColor = agentConfig?.ui?.color;
  const configName = agentConfig?.name;

  const defaults = DEFAULT_AGENT_CONFIG[agentId];

  return {
    emoji: configEmoji || defaults?.emoji || "🤖",
    color: configColor || defaults?.color || "#666666",
    name: configName || defaults?.name || agentId,
  };
}

function cloneAgents(agents: AgentSummary[]): AgentSummary[] {
  return agents.map((agent) => ({
    ...agent,
    allowAgents: agent.allowAgents ? [...agent.allowAgents] : [],
    allowAgentsDetails: agent.allowAgentsDetails
      ? agent.allowAgentsDetails.map((entry) => ({ ...entry }))
      : [],
  }));
}

function runOpenClaw(args: string[], timeoutMs = 5000): string {
  const execOptions = {
    encoding: "utf-8" as BufferEncoding,
    timeout: timeoutMs,
    windowsHide: true,
  };

  let result = null as ReturnType<typeof spawnSync> | null;

  if (OPENCLAW_POWERSHELL_SCRIPT) {
    result = spawnSync(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", OPENCLAW_POWERSHELL_SCRIPT, ...args],
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

function listOpenClawSessions(): OpenClawSessionsPayload {
  const output = runOpenClaw(["sessions", "--all-agents", "--json"]);
  const parsed = JSON.parse(output);
  if (!parsed || typeof parsed !== "object") return {};
  return parsed as OpenClawSessionsPayload;
}

function cloneSessions(payload: OpenClawSessionsPayload): OpenClawSessionsPayload {
  return {
    sessions: Array.isArray(payload.sessions)
      ? payload.sessions.map((session) => ({ ...session }))
      : [],
  };
}

function getSessionsPayload(): OpenClawSessionsPayload {
  if (sessionsCache && Date.now() - sessionsCache.updatedAt < SESSIONS_CACHE_TTL_MS) {
    return cloneSessions(sessionsCache.payload);
  }

  try {
    const payload = listOpenClawSessions();
    sessionsCache = {
      payload: cloneSessions(payload),
      updatedAt: Date.now(),
    };
    return payload;
  } catch {
    return sessionsCache ? cloneSessions(sessionsCache.payload) : { sessions: [] };
  }
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

    const stats = map.get(agentId) || { activeSessions: 0, lastActiveAt: undefined };

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

function loadAgentsFromConfig(): AgentSummary[] {
  const configPath = OPENCLAW_CONFIG;
  const config = JSON.parse(readFileSync(configPath, "utf-8")) as OpenClawConfig;

  const configuredAgents = Array.isArray(config?.agents?.list) ? config.agents.list : [];
  const defaultWorkspace = config?.agents?.defaults?.workspace || join(OPENCLAW_DIR, "workspace");
  const sessionStatsMap = buildSessionStatsMap(getSessionsPayload());

  const normalizedAgents: OpenClawAgentConfig[] =
    configuredAgents.length > 0
      ? configuredAgents
      : [
          {
            id: "main",
            name: process.env.NEXT_PUBLIC_AGENT_NAME || "main",
            workspace: defaultWorkspace,
            model: {
              primary: config?.agents?.defaults?.model?.primary || "unknown",
            },
            subagents: { allowAgents: [] },
            ui: {
              emoji: process.env.NEXT_PUBLIC_AGENT_EMOJI || "🤖",
            },
          },
        ];

  return normalizedAgents.map((agent) => {
    const agentInfo = getAgentDisplayInfo(agent.id, agent);
    const telegramAccount = config.channels?.telegram?.accounts?.[agent.id];
    const botToken = telegramAccount?.botToken;
    const workspace =
      typeof agent.workspace === "string" && agent.workspace.trim().length > 0
        ? agent.workspace
        : defaultWorkspace;

    const sessionStats = sessionStatsMap.get(agent.id) || {
      activeSessions: 0,
      lastActiveAt: undefined,
    };

    const allowAgents = Array.isArray(agent.subagents?.allowAgents)
      ? agent.subagents.allowAgents
      : [];

    const allowAgentsDetails = allowAgents.map((subagentId) => {
      const subagentConfig = normalizedAgents.find((entry) => entry.id === subagentId);
      if (subagentConfig) {
        const subagentInfo = getAgentDisplayInfo(subagentId, subagentConfig);
        return {
          id: subagentId,
          name: subagentConfig.name || subagentInfo.name,
          emoji: subagentInfo.emoji,
          color: subagentInfo.color,
        };
      }

      const fallbackInfo = getAgentDisplayInfo(subagentId, null);
      return {
        id: subagentId,
        name: fallbackInfo.name,
        emoji: fallbackInfo.emoji,
        color: fallbackInfo.color,
      };
    });

    return {
      id: agent.id,
      name: agent.name || agentInfo.name,
      emoji: agentInfo.emoji,
      color: agentInfo.color,
      model: agent.model?.primary || config.agents?.defaults?.model?.primary || "unknown",
      workspace,
      dmPolicy: telegramAccount?.dmPolicy || config.channels?.telegram?.dmPolicy || "pairing",
      allowAgents,
      allowAgentsDetails,
      botToken: botToken ? "configured" : undefined,
      status: sessionStats.activeSessions > 0 ? "online" : "offline",
      lastActivity: sessionStats.lastActiveAt,
      activeSessions: sessionStats.activeSessions,
    } satisfies AgentSummary;
  });
}

export async function getAgentsSummary(): Promise<AgentSummary[]> {
  if (agentsCache && Date.now() - agentsCache.updatedAt < AGENTS_CACHE_TTL_MS) {
    return cloneAgents(agentsCache.agents);
  }

  const agents = loadAgentsFromConfig();
  agentsCache = {
    agents: cloneAgents(agents),
    updatedAt: Date.now(),
  };

  return agents;
}
