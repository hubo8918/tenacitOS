"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  Circle,
  MessageSquare,
  HardDrive,
  Shield,
  Users,
  Activity,
  GitBranch,
  LayoutGrid,
  Settings2,
  Edit3,
  Save,
  X,
} from "lucide-react";
import { AgentOrganigrama } from "@/components/AgentOrganigrama";
import { useFetch } from "@/lib/useFetch";

interface AgentPayload {
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
  canLead: boolean;
  canReview: boolean;
  canExecute: boolean;
  workTypes: string[];
  capabilityProfileConfigured: boolean;
}

interface Agent extends AgentPayload {
  name: string;
  allowAgents: string[];
}

interface AgentsPageClientProps {
  initialAgents: AgentPayload[];
}

function formatLastActivity(timestamp?: string) {
  if (!timestamp) return "Never";
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function parseWorkTypesInput(raw: string): string[] {
  const seen = new Set<string>();

  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function CapabilityEditor({
  agent,
  onSaved,
}: {
  agent: Agent;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canLead, setCanLead] = useState(agent.canLead);
  const [canReview, setCanReview] = useState(agent.canReview);
  const [canExecute, setCanExecute] = useState(agent.canExecute);
  const [workTypesInput, setWorkTypesInput] = useState(agent.workTypes.join(", "));

  useEffect(() => {
    setCanLead(agent.canLead);
    setCanReview(agent.canReview);
    setCanExecute(agent.canExecute);
    setWorkTypesInput(agent.workTypes.join(", "));
    setError(null);
  }, [agent]);

  const reset = () => {
    setCanLead(agent.canLead);
    setCanReview(agent.canReview);
    setCanExecute(agent.canExecute);
    setWorkTypesInput(agent.workTypes.join(", "));
    setError(null);
  };

  const handleCancel = () => {
    reset();
    setEditing(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/agents", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: agent.id,
          canLead,
          canReview,
          canExecute,
          workTypes: parseWorkTypesInput(workTypesInput),
        }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error || "Failed to save capability profile");
      }

      setEditing(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const badgeStyle = (active: boolean): React.CSSProperties => ({
    border: `1px solid ${active ? `${agent.color}55` : "var(--border)"}`,
    backgroundColor: active ? `${agent.color}14` : "var(--surface-elevated)",
    color: active ? agent.color : "var(--text-muted)",
  });

  const checkboxLabelStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    fontSize: "0.8125rem",
    color: "var(--text-primary)",
  };

  if (editing) {
    return (
      <div
        className="rounded-lg p-3 space-y-3"
        style={{
          border: `1px solid ${agent.color}40`,
          backgroundColor: `${agent.color}0d`,
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
              Edit capability profile
            </div>
            <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
              Coordination metadata for Mission Control only. Runtime model/workspace stay read-only.
            </p>
          </div>
          <button
            onClick={handleCancel}
            className="p-1 rounded-md"
            style={{ color: "var(--text-muted)" }}
            aria-label="Cancel editing capability profile"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <label style={checkboxLabelStyle}>
            <input type="checkbox" checked={canLead} onChange={(e) => setCanLead(e.target.checked)} />
            Can lead
          </label>
          <label style={checkboxLabelStyle}>
            <input type="checkbox" checked={canReview} onChange={(e) => setCanReview(e.target.checked)} />
            Can review
          </label>
          <label style={checkboxLabelStyle}>
            <input type="checkbox" checked={canExecute} onChange={(e) => setCanExecute(e.target.checked)} />
            Can execute
          </label>
        </div>

        <div>
          <div className="text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>
            Accepted work types
          </div>
          <input
            type="text"
            value={workTypesInput}
            onChange={(e) => setWorkTypesInput(e.target.value)}
            placeholder="ops, frontend, review"
            className="w-full text-sm rounded-lg px-3 py-2"
            style={{
              backgroundColor: "var(--surface-elevated)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
              outline: "none",
            }}
          />
          <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
            Comma-separated planning labels, not live runtime restrictions.
          </p>
        </div>

        {error && (
          <p className="text-xs" style={{ color: "var(--negative, #FF453A)" }}>
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            onClick={handleCancel}
            className="text-xs px-3 py-1.5 rounded-md"
            style={{
              color: "var(--text-secondary)",
              border: "1px solid var(--border)",
              backgroundColor: "var(--surface-elevated)",
            }}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md"
            style={{
              color: "white",
              backgroundColor: agent.color,
              border: `1px solid ${agent.color}`,
              opacity: saving ? 0.7 : 1,
            }}
            disabled={saving}
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? "Saving..." : "Save profile"}
          </button>
        </div>
      </div>
    );
  }

  const capabilityBadges = [
    { label: "Lead", active: agent.canLead },
    { label: "Review", active: agent.canReview },
    { label: "Execute", active: agent.canExecute },
  ];

  return (
    <div
      className="rounded-lg p-3 space-y-3"
      style={{
        border: "1px solid var(--border)",
        backgroundColor: "var(--surface-elevated)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
            Mission Control capability profile
          </div>
          <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
            Coordination metadata for planning and routing. Runtime model/workspace above remain read-only.
          </p>
        </div>
        <button
          onClick={() => {
            reset();
            setEditing(true);
          }}
          className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md"
          style={{
            color: "var(--text-secondary)",
            border: "1px solid var(--border)",
            backgroundColor: "var(--card)",
          }}
        >
          <Edit3 className="w-3.5 h-3.5" />
          Edit
        </button>
      </div>

      {agent.capabilityProfileConfigured ? (
        <>
          <div className="flex flex-wrap gap-2">
            {capabilityBadges.map((badge) => (
              <span
                key={badge.label}
                className="text-xs px-2.5 py-1 rounded-full font-medium"
                style={badgeStyle(badge.active)}
              >
                {badge.label}
              </span>
            ))}
          </div>

          {agent.workTypes.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {agent.workTypes.map((workType) => (
                <span
                  key={workType}
                  className="text-xs px-2.5 py-1 rounded-full"
                  style={{
                    backgroundColor: `${agent.color}14`,
                    color: agent.color,
                    border: `1px solid ${agent.color}35`,
                  }}
                >
                  {workType}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              No work-type labels saved yet.
            </p>
          )}
        </>
      ) : (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          No capability profile saved yet.
        </p>
      )}
    </div>
  );
}

function AgentRuntimeCard({ agent, onSaved }: { agent: Agent; onSaved: () => void }) {
  return (
    <div
      id={`agent-card-${agent.id}`}
      className="rounded-xl overflow-hidden transition-all hover:scale-[1.02] scroll-mt-6"
      style={{
        backgroundColor: "var(--card)",
        border: "1px solid var(--border)",
      }}
    >
      <div
        className="px-5 py-4 flex items-center justify-between"
        style={{
          borderBottom: "1px solid var(--border)",
          background: `linear-gradient(135deg, ${agent.color}15, transparent)`,
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
            style={{
              backgroundColor: `${agent.color}20`,
              border: `2px solid ${agent.color}`,
            }}
          >
            {agent.emoji}
          </div>
          <div>
            <h3
              className="text-lg font-bold"
              style={{
                fontFamily: "var(--font-heading)",
                color: "var(--text-primary)",
              }}
            >
              {agent.name}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <Circle
                className="w-2 h-2"
                style={{
                  fill: agent.status === "online" ? "#4ade80" : "#6b7280",
                  color: agent.status === "online" ? "#4ade80" : "#6b7280",
                }}
              />
              <span
                className="text-xs font-medium"
                style={{
                  color: agent.status === "online" ? "#4ade80" : "var(--text-muted)",
                }}
              >
                {agent.status}
              </span>
            </div>
          </div>
        </div>

        {agent.botToken && (
          <div title="Telegram Bot Connected">
            <MessageSquare className="w-5 h-5" style={{ color: "#0088cc" }} />
          </div>
        )}
      </div>

      <div className="p-5 space-y-4">
        <div className="flex items-start gap-3">
          <Bot className="w-4 h-4 mt-0.5" style={{ color: agent.color }} />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>
              Model
            </div>
            <div className="text-sm font-mono truncate" style={{ color: "var(--text-primary)" }}>
              {agent.model}
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <HardDrive className="w-4 h-4 mt-0.5" style={{ color: agent.color }} />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>
              Workspace
            </div>
            <div
              className="text-sm font-mono truncate"
              style={{ color: "var(--text-primary)" }}
              title={agent.workspace}
            >
              {agent.workspace}
            </div>
          </div>
        </div>

        {agent.dmPolicy && (
          <div className="flex items-start gap-3">
            <Shield className="w-4 h-4 mt-0.5" style={{ color: agent.color }} />
            <div className="flex-1">
              <div className="text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>
                DM Policy
              </div>
              <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                {agent.dmPolicy}
              </div>
            </div>
          </div>
        )}

        {agent.allowAgents.length > 0 && (
          <div className="flex items-start gap-3">
            <Users className="w-4 h-4 mt-0.5" style={{ color: agent.color }} />
            <div className="flex-1">
              <div className="text-xs font-medium mb-2" style={{ color: "var(--text-muted)" }}>
                Can spawn subagents ({agent.allowAgents.length})
              </div>
              <div className="flex flex-wrap gap-2">
                {agent.allowAgentsDetails && agent.allowAgentsDetails.length > 0 ? (
                  agent.allowAgentsDetails.map((subagent) => (
                    <div
                      key={subagent.id}
                      className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all hover:scale-105"
                      style={{
                        backgroundColor: `${subagent.color}15`,
                        border: `1px solid ${subagent.color}40`,
                      }}
                      title={`${subagent.name} (${subagent.id})`}
                    >
                      <span className="text-sm">{subagent.emoji}</span>
                      <span
                        style={{
                          color: subagent.color,
                          fontWeight: 600,
                        }}
                      >
                        {subagent.name}
                      </span>
                    </div>
                  ))
                ) : (
                  agent.allowAgents.map((subagent) => (
                    <span
                      key={subagent}
                      className="text-xs px-2 py-1 rounded"
                      style={{
                        backgroundColor: `${agent.color}20`,
                        color: agent.color,
                        fontWeight: 500,
                      }}
                    >
                      {subagent}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-start gap-3">
          <Settings2 className="w-4 h-4 mt-0.5" style={{ color: agent.color }} />
          <div className="flex-1 min-w-0">
            <CapabilityEditor agent={agent} onSaved={onSaved} />
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Last activity: {formatLastActivity(agent.lastActivity)}
            </span>
          </div>
          {agent.activeSessions > 0 && (
            <span
              className="text-xs font-medium px-2 py-1 rounded"
              style={{
                backgroundColor: "var(--success)20",
                color: "var(--success)",
              }}
            >
              {agent.activeSessions} active
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AgentsPageClient({ initialAgents }: AgentsPageClientProps) {
  const hasInitialAgents = initialAgents.length > 0;
  const { data, loading, error, refetch } = useFetch<{ agents: AgentPayload[] }>("/api/agents", {
    initialData: hasInitialAgents ? { agents: initialAgents } : null,
    fetchOnMount: !hasInitialAgents,
  });
  const agents = useMemo<Agent[]>(
    () =>
      (data?.agents || []).map((agent) => ({
        ...agent,
        name: agent.name || agent.id,
        allowAgents: agent.allowAgents || [],
        workTypes: agent.workTypes || [],
      })),
    [data]
  );
  const [activeTab, setActiveTab] = useState<"cards" | "orgChart">("cards");

  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 30000);

    return () => clearInterval(interval);
  }, [refetch]);

  if (loading && !data) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-pulse text-lg" style={{ color: "var(--text-muted)" }}>
            Loading agents...
          </div>
        </div>
      </div>
    );
  }

  if (error && agents.length === 0) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div
            className="rounded-xl px-5 py-4 text-center max-w-md"
            style={{
              border: "1px solid var(--negative, #FF453A)",
              backgroundColor: "color-mix(in srgb, var(--negative, #FF453A) 8%, transparent)",
            }}
          >
            <p className="text-sm mb-3" style={{ color: "var(--negative, #FF453A)" }}>
              Agents data is temporarily unavailable: {error}
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
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1
          className="text-3xl font-bold mb-2"
          style={{
            fontFamily: "var(--font-heading)",
            color: "var(--text-primary)",
            letterSpacing: "-1.5px",
          }}
        >
          <Users className="inline-block w-8 h-8 mr-2 mb-1" />
          Agents
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
          Runtime & configuration view • {agents.length} agents configured
        </p>
        <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
          Use this page for models, workspaces, permissions, recent activity, and Mission Control capability profiles.
          {" "}
          <Link href="/agents/team" style={{ color: "var(--accent)", fontWeight: 600 }}>
            Looking for roles and personalities? Open Team →
          </Link>
        </p>
      </div>

      {error && agents.length > 0 && (
        <div
          className="rounded-lg px-4 py-3 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
          style={{
            border: "1px solid var(--negative, #FF453A)",
            backgroundColor: "color-mix(in srgb, var(--negative, #FF453A) 6%, transparent)",
          }}
        >
          <p className="text-xs" style={{ color: "var(--negative, #FF453A)" }}>
            Live sync delayed: {error}
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

      <div className="flex gap-2 mb-6 border-b" style={{ borderColor: "var(--border)" }}>
        {[
          { id: "cards" as const, label: "Agent Cards", icon: LayoutGrid },
          { id: "orgChart" as const, label: "Org Chart", icon: GitBranch },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className="flex items-center gap-2 px-4 py-2 font-medium transition-all"
            style={{
              color: activeTab === id ? "var(--accent)" : "var(--text-secondary)",
              borderBottom: activeTab === id ? "2px solid var(--accent)" : "2px solid transparent",
              background: "none",
              border: "none",
              cursor: "pointer",
              borderBottomStyle: "solid",
              borderBottomWidth: "2px",
              borderBottomColor: activeTab === id ? "var(--accent)" : "transparent",
              paddingBottom: "0.5rem",
            }}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === "orgChart" && (
        <div className="rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
            <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>
              Agent Hierarchy
            </h2>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Visualization of agent communication allowances
            </p>
          </div>
          <AgentOrganigrama agents={agents} />
        </div>
      )}

      {activeTab === "cards" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {agents.map((agent) => (
            <AgentRuntimeCard key={agent.id} agent={agent} onSaved={refetch} />
          ))}
        </div>
      )}
    </div>
  );
}
