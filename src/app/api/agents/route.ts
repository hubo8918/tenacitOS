import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

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

// Fallback config used when an agent doesn't define its own ui config in openclaw.json.
// The main agent reads name/emoji from env vars; all others fall back to generic defaults.
// Override via each agent's openclaw.json → ui.emoji / ui.color / name fields.
const DEFAULT_AGENT_CONFIG: Record<string, { emoji: string; color: string; name?: string }> = {
  main: {
    emoji: process.env.NEXT_PUBLIC_AGENT_EMOJI || "🤖",
    color: "#ff6b35",
    name: process.env.NEXT_PUBLIC_AGENT_NAME || "Mission Control",
  },
};

/**
 * Get agent display info (emoji, color, name) from openclaw.json or defaults
 */
function getAgentDisplayInfo(agentId: string, agentConfig: any): { emoji: string; color: string; name: string } {
  // First try to get from agent's own config in openclaw.json
  const configEmoji = agentConfig?.ui?.emoji;
  const configColor = agentConfig?.ui?.color;
  const configName = agentConfig?.name;

  // Then try defaults
  const defaults = DEFAULT_AGENT_CONFIG[agentId];

  return {
    emoji: configEmoji || defaults?.emoji || "🤖",
    color: configColor || defaults?.color || "#666666",
    name: configName || defaults?.name || agentId,
  };
}

export async function GET() {
  try {
    // Read openclaw config
    const configPath = (process.env.OPENCLAW_DIR || "/root/.openclaw") + "/openclaw.json";
    const config = JSON.parse(readFileSync(configPath, "utf-8"));

    // Support both legacy configs (agents.list) and modern configs (defaults-only)
    const configuredAgents = Array.isArray(config?.agents?.list)
      ? config.agents.list
      : [];

    const normalizedAgents =
      configuredAgents.length > 0
        ? configuredAgents
        : [
            {
              id: "main",
              name: process.env.NEXT_PUBLIC_AGENT_NAME || "main",
              workspace:
                config?.agents?.defaults?.workspace ||
                join(process.env.OPENCLAW_DIR || "/root/.openclaw", "workspace"),
              model: {
                primary:
                  config?.agents?.defaults?.model?.primary || "unknown",
              },
              subagents: { allowAgents: [] },
              ui: {
                emoji: process.env.NEXT_PUBLIC_AGENT_EMOJI || "🤖",
              },
            },
          ];

    const agents: Agent[] = normalizedAgents.map((agent: any) => {
      const agentInfo = getAgentDisplayInfo(agent.id, agent);

      // Get telegram account info
      const telegramAccount =
        config.channels?.telegram?.accounts?.[agent.id];
      const botToken = telegramAccount?.botToken;

      // Check if agent has recent activity
      const memoryPath = join(agent.workspace, "memory");
      let lastActivity = undefined;
      let status: "online" | "offline" = "offline";

      try {
        const today = new Date().toISOString().split("T")[0];
        const memoryFile = join(memoryPath, `${today}.md`);
        const stat = require("fs").statSync(memoryFile);
        lastActivity = stat.mtime.toISOString();
        // Consider online if activity within last 5 minutes
        status =
          Date.now() - stat.mtime.getTime() < 5 * 60 * 1000
            ? "online"
            : "offline";
      } catch (e) {
        // No recent activity
      }

      // Get details of allowed subagents
      const allowAgents = agent.subagents?.allowAgents || [];
      const allowAgentsDetails = allowAgents.map((subagentId: string) => {
        // Find subagent in config
        const subagentConfig = normalizedAgents.find(
          (a: any) => a.id === subagentId
        );
        if (subagentConfig) {
          const subagentInfo = getAgentDisplayInfo(subagentId, subagentConfig);
          return {
            id: subagentId,
            name: subagentConfig.name || subagentInfo.name,
            emoji: subagentInfo.emoji,
            color: subagentInfo.color,
          };
        }
        // Fallback if subagent not found in config
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
        model:
          agent.model?.primary || config.agents.defaults.model.primary,
        workspace: agent.workspace,
        dmPolicy:
          telegramAccount?.dmPolicy ||
          config.channels?.telegram?.dmPolicy ||
          "pairing",
        allowAgents,
        allowAgentsDetails,
        botToken: botToken ? "configured" : undefined,
        status,
        lastActivity,
        activeSessions: 0, // TODO: get from sessions API
      };
    });

    return NextResponse.json({ agents });
  } catch (error) {
    console.error("Error reading agents:", error);
    return NextResponse.json(
      { error: "Failed to load agents" },
      { status: 500 }
    );
  }
}
