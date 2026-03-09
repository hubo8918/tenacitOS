import { NextResponse } from "next/server";
import { readFileSync, statSync } from "fs";
import { join } from "path";
import { OPENCLAW_DIR, OPENCLAW_CONFIG } from "@/lib/paths";

export const dynamic = "force-dynamic";

interface Agent {
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
  workspace: string;
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

const DEFAULT_AGENT_CONFIG: Record<string, { emoji: string; color: string; name?: string }> = {
  main: {
    emoji: process.env.NEXT_PUBLIC_AGENT_EMOJI || "🤖",
    color: "#ff6b35",
    name: process.env.NEXT_PUBLIC_AGENT_NAME || "Mission Control",
  },
};

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

export async function GET() {
  try {
    const configPath = OPENCLAW_CONFIG;
    const config = JSON.parse(readFileSync(configPath, "utf-8")) as OpenClawConfig;

    const configuredAgents = Array.isArray(config?.agents?.list) ? config.agents.list : [];

    const normalizedAgents: OpenClawAgentConfig[] =
      configuredAgents.length > 0
        ? configuredAgents
        : [
            {
              id: "main",
              name: process.env.NEXT_PUBLIC_AGENT_NAME || "main",
              workspace: config?.agents?.defaults?.workspace || join(OPENCLAW_DIR, "workspace"),
              model: {
                primary: config?.agents?.defaults?.model?.primary || "unknown",
              },
              subagents: { allowAgents: [] },
              ui: {
                emoji: process.env.NEXT_PUBLIC_AGENT_EMOJI || "🤖",
              },
            },
          ];

    const agents: Agent[] = normalizedAgents.map((agent) => {
      const agentInfo = getAgentDisplayInfo(agent.id, agent);

      const telegramAccount = config.channels?.telegram?.accounts?.[agent.id];
      const botToken = telegramAccount?.botToken;

      const memoryPath = join(agent.workspace, "memory");
      let lastActivity: string | undefined;
      let status: "online" | "offline" = "offline";

      try {
        const today = new Date().toISOString().split("T")[0];
        const memoryFile = join(memoryPath, `${today}.md`);
        const stat = statSync(memoryFile);
        lastActivity = stat.mtime.toISOString();
        status = Date.now() - stat.mtime.getTime() < 5 * 60 * 1000 ? "online" : "offline";
      } catch {
        // No recent activity.
      }

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
        workspace: agent.workspace,
        dmPolicy: telegramAccount?.dmPolicy || config.channels?.telegram?.dmPolicy || "pairing",
        allowAgents,
        allowAgentsDetails,
        botToken: botToken ? "configured" : undefined,
        status,
        lastActivity,
        activeSessions: 0,
      };
    });

    return NextResponse.json({ agents });
  } catch (error) {
    console.error("Error reading agents:", error);
    return NextResponse.json({ error: "Failed to load agents" }, { status: 500 });
  }
}
