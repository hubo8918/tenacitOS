"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AgentCard } from "@/components/AgentCard";
import { TierDivider } from "@/components/TierDivider";
import { tierConfig } from "@/data/mockTeamData";
import { useFetch } from "@/lib/useFetch";
import type { TeamAgent } from "@/data/mockTeamData";

type TierFilter = "all" | TeamAgent["tier"];
type ActivityFilter = "all" | "active" | "idle" | "never";

interface TeamPageClientProps {
  initialTeam: TeamAgent[];
}

function getActivityState(agent: TeamAgent): Exclude<ActivityFilter, "all"> {
  if ((agent.activeSessions ?? 0) > 0) return "active";
  if (agent.lastActiveAt) return "idle";
  return "never";
}

function workspaceLabel(workspace?: string): string {
  if (!workspace) return "unknown";
  const normalized = workspace.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  return parts[parts.length - 1] || workspace;
}

function describeTeamError(error: string | null): string {
  if (!error) return "Unknown error";
  if (error.startsWith("Request timed out")) {
    return "Team data is temporarily unavailable (request timed out).";
  }
  return error;
}

export default function TeamPageClient({ initialTeam }: TeamPageClientProps) {
  const hasInitialTeam = initialTeam.length > 0;

  const { data, loading, error, refetch } = useFetch<{ team: TeamAgent[] }>("/api/team", {
    timeoutMs: 10_000,
    initialData: hasInitialTeam ? { team: initialTeam } : null,
    fetchOnMount: !hasInitialTeam,
  });
  const teamAgents = useMemo(() => data?.team || [], [data]);
  const friendlyError = useMemo(() => describeTeamError(error), [error]);

  const [query, setQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [modelFilter, setModelFilter] = useState("all");
  const [workspaceFilter, setWorkspaceFilter] = useState("all");

  useEffect(() => {
    const timer = setInterval(() => {
      refetch();
    }, 30_000);

    return () => clearInterval(timer);
  }, [refetch]);

  const modelOptions = useMemo(() => {
    return Array.from(new Set(teamAgents.map((agent) => agent.model || "unknown"))).sort();
  }, [teamAgents]);

  const workspaceOptions = useMemo(() => {
    return Array.from(new Set(teamAgents.map((agent) => workspaceLabel(agent.workspace)))).sort();
  }, [teamAgents]);

  const filteredAgents = useMemo(() => {
    const q = query.trim().toLowerCase();

    return teamAgents.filter((agent) => {
      if (tierFilter !== "all" && agent.tier !== tierFilter) return false;

      const activity = getActivityState(agent);
      if (activityFilter !== "all" && activity !== activityFilter) return false;

      const model = agent.model || "unknown";
      if (modelFilter !== "all" && model !== modelFilter) return false;

      const workspace = workspaceLabel(agent.workspace);
      if (workspaceFilter !== "all" && workspace !== workspaceFilter) return false;

      if (!q) return true;

      const haystack = [
        agent.id,
        agent.name,
        agent.role,
        agent.description,
        agent.model || "",
        agent.workspace || "",
        agent.tags.map((tag) => tag.label).join(" "),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [teamAgents, query, tierFilter, activityFilter, modelFilter, workspaceFilter]);

  const summary = useMemo(() => {
    const active = filteredAgents.filter((agent) => getActivityState(agent) === "active").length;
    const idle = filteredAgents.filter((agent) => getActivityState(agent) === "idle").length;
    const never = filteredAgents.filter((agent) => getActivityState(agent) === "never").length;

    return {
      total: filteredAgents.length,
      active,
      idle,
      never,
    };
  }, [filteredAgents]);

  if (loading && !data) {
    return (
      <div className="p-4 md:p-8 flex items-center justify-center min-h-[400px]">
        <div className="text-sm" style={{ color: "var(--text-muted)" }}>
          Loading team...
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-4 md:p-8 flex items-center justify-center min-h-[400px]">
        <div
          className="rounded-xl px-5 py-4 text-center max-w-md"
          style={{
            border: "1px solid var(--negative, #FF453A)",
            backgroundColor: "color-mix(in srgb, var(--negative, #FF453A) 8%, transparent)",
          }}
        >
          <p className="text-sm mb-3" style={{ color: "var(--negative, #FF453A)" }}>
            {friendlyError}
          </p>
          <button
            onClick={() => refetch()}
            className="text-xs px-3 py-1.5 rounded-md"
            style={{
              color: "var(--text-secondary)",
              border: "1px solid var(--border)",
              backgroundColor: "var(--surface-elevated)",
            }}
          >
            Retry now
          </button>
        </div>
      </div>
    );
  }

  const controlStyle: React.CSSProperties = {
    backgroundColor: "var(--surface-elevated)",
    border: "1px solid var(--border)",
    color: "var(--text-primary)",
    borderRadius: "0.5rem",
    fontSize: "0.8125rem",
    padding: "0.5rem 0.625rem",
    width: "100%",
    outline: "none",
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div
        className="rounded-xl p-6 md:p-8 mb-8 md:mb-12 text-center"
        style={{
          backgroundColor: "var(--surface-elevated)",
          border: "1px solid var(--border)",
          backgroundImage:
            "linear-gradient(135deg, rgba(255, 59, 48, 0.05), rgba(191, 90, 242, 0.05))",
        }}
      >
        <p
          className="text-sm md:text-base italic"
          style={{
            color: "var(--text-secondary)",
            fontFamily: "var(--font-body)",
            lineHeight: 1.6,
          }}
        >
          &ldquo;An autonomous organization of AI agents that does work for me and produces value 24/7&rdquo;
        </p>
      </div>

      <div className="text-center mb-8 md:mb-10">
        <h1
          className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4"
          style={{
            fontFamily: "var(--font-heading)",
            color: "var(--text-primary)",
            letterSpacing: "-1.5px",
          }}
        >
          Meet the Team
        </h1>
        <p
          className="text-base md:text-lg mb-4"
          style={{
            color: "var(--text-secondary)",
            fontFamily: "var(--font-heading)",
            fontWeight: 500,
          }}
        >
          Organization view • {teamAgents.length} team profiles (excluding the main system controller) with roles,
          identity, and collaboration context.
        </p>
        <p
          className="text-sm max-w-2xl mx-auto"
          style={{
            color: "var(--text-muted)",
            lineHeight: 1.7,
          }}
        >
          This page is for understanding who each agent is, what they are responsible for, and how the team is
          organized. Presence labels here mean <strong>active now</strong>, <strong>recently seen</strong>, or
          <strong> no activity yet</strong> — not the same thing as runtime online/offline.{" "}
          <Link href="/agents" style={{ color: "var(--accent)", fontWeight: 600 }}>
            Need models, workspaces, permissions, or runtime status? Open Agents →
          </Link>
        </p>
        <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
          Live sync enabled · Team status refreshes every 30s
          {loading ? " · syncing..." : error ? " · sync delayed" : ""}
        </p>
      </div>

      {error && data && (
        <div
          className="rounded-lg px-4 py-3 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
          style={{
            border: "1px solid var(--negative, #FF453A)",
            backgroundColor: "color-mix(in srgb, var(--negative, #FF453A) 6%, transparent)",
          }}
        >
          <p className="text-xs" style={{ color: "var(--negative, #FF453A)" }}>
            Live sync delayed: {friendlyError}
          </p>
          <button
            onClick={() => refetch()}
            className="text-xs px-2.5 py-1 rounded-md"
            style={{
              color: "var(--text-secondary)",
              border: "1px solid var(--border)",
              backgroundColor: "var(--surface-elevated)",
            }}
          >
            Retry now
          </button>
        </div>
      )}

      <div
        className="rounded-xl p-4 mb-8"
        style={{
          backgroundColor: "var(--surface-elevated)",
          border: "1px solid var(--border)",
        }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, role, skill, model..."
            style={controlStyle}
            aria-label="Search team"
          />

          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value as TierFilter)}
            style={controlStyle}
            aria-label="Filter by tier"
          >
            <option value="all">All tiers</option>
            <option value="leadership">Leadership</option>
            <option value="operations">Operations</option>
            <option value="io">Input/Output</option>
            <option value="meta">Meta</option>
          </select>

          <select
            value={activityFilter}
            onChange={(e) => setActivityFilter(e.target.value as ActivityFilter)}
            style={controlStyle}
            aria-label="Filter by presence"
          >
            <option value="all">All presence</option>
            <option value="active">Active now</option>
            <option value="idle">Recently seen</option>
            <option value="never">No activity yet</option>
          </select>

          <select
            value={modelFilter}
            onChange={(e) => setModelFilter(e.target.value)}
            style={controlStyle}
            aria-label="Filter by model"
          >
            <option value="all">All models</option>
            {modelOptions.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>

          <select
            value={workspaceFilter}
            onChange={(e) => setWorkspaceFilter(e.target.value)}
            style={controlStyle}
            aria-label="Filter by workspace"
          >
            <option value="all">All workspaces</option>
            {workspaceOptions.map((workspace) => (
              <option key={workspace} value={workspace}>
                {workspace}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-3 mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
          <span>
            shown <strong style={{ color: "var(--text-secondary)" }}>{summary.total}</strong>
          </span>
          <span>
            active now <strong style={{ color: "#4ade80" }}>{summary.active}</strong>
          </span>
          <span>
            recently seen <strong style={{ color: "#f59e0b" }}>{summary.idle}</strong>
          </span>
          <span>
            no activity yet <strong style={{ color: "#9ca3af" }}>{summary.never}</strong>
          </span>
        </div>
      </div>

      {tierConfig.map((tier) => {
        const agents = filteredAgents.filter((agent) => agent.tier === tier.id);
        if (agents.length === 0) return null;

        return (
          <div key={tier.id}>
            {tier.label && <TierDivider label={tier.label} />}

            <div className={`grid ${tier.gridCols} gap-4 md:gap-6 mx-auto ${tier.maxWidth || ""}`}>
              {agents.map((agent) => (
                <AgentCard key={agent.id} agent={agent} onUpdate={refetch} />
              ))}
            </div>
          </div>
        );
      })}

      {filteredAgents.length === 0 && (
        <div
          className="rounded-xl p-8 text-center"
          style={{
            backgroundColor: "var(--surface-elevated)",
            border: "1px solid var(--border)",
            color: "var(--text-muted)",
          }}
        >
          No agents matched the current filters.
        </div>
      )}

      <div className="h-12" />
    </div>
  );
}
