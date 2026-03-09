"use client";

import { useState } from "react";
import { Edit3, X, Save } from "lucide-react";

interface TeamAgent {
  id: string;
  name: string;
  role: string;
  emoji: string;
  color: string;
  description: string;
  tags: Array<{ label: string; color: string }>;
  status: "online" | "offline";
  tier: string;
  specialBadge?: string;
  activeSessions?: number;
  lastActiveAt?: string | null;
  model?: string;
  workspace?: string;
  identitySource?: string;
}

interface AgentActionResult {
  action: "wake" | "check-in";
  text: string;
  durationMs?: number | null;
  model?: string | null;
  sessionId?: string | null;
  timestamp?: string | null;
}

interface AgentCardProps {
  agent: TeamAgent;
  onUpdate?: () => void;
}

type PresenceState = "active" | "idle" | "never";

function formatLastActive(lastActiveAt?: string | null): string {
  if (!lastActiveAt) return "never";

  const date = new Date(lastActiveAt);
  if (Number.isNaN(date.getTime())) return "unknown";

  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60_000) return "just now";

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatActionTime(timestamp?: string | null): string {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatWorkspace(workspace?: string): string {
  if (!workspace) return "unknown";

  const normalized = workspace.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  return parts[parts.length - 1] || workspace;
}

function formatModel(model?: string | null): string {
  if (!model) return "unknown";
  return model.length > 24 ? `${model.slice(0, 24)}…` : model;
}

function getPresenceState(agent: TeamAgent): PresenceState {
  if ((agent.activeSessions ?? 0) > 0) return "active";
  if (agent.lastActiveAt) return "idle";
  return "never";
}

function getPresenceMeta(state: PresenceState): {
  label: string;
  color: string;
  glow: string;
} {
  if (state === "active") {
    return {
      label: "Active now",
      color: "#4ade80",
      glow: "0 0 6px #4ade8060",
    };
  }

  if (state === "idle") {
    return {
      label: "Recently seen",
      color: "#f59e0b",
      glow: "none",
    };
  }

  return {
    label: "No activity yet",
    color: "#6b7280",
    glow: "none",
  };
}

export function AgentCard({ agent, onUpdate }: AgentCardProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(agent.name);
  const [emoji, setEmoji] = useState(agent.emoji);
  const [role, setRole] = useState(agent.role);
  const [description, setDescription] = useState(agent.description);
  const [saving, setSaving] = useState(false);
  const [actionRunning, setActionRunning] = useState<"wake" | "check-in" | null>(null);
  const [actionResult, setActionResult] = useState<AgentActionResult | null>(null);

  const presence = getPresenceMeta(getPresenceState(agent));

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/team", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: agent.id, name, emoji, role, description }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to save agent");
      }

      setEditing(false);
      onUpdate?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setActionResult({ action: "check-in", text: `error: ${message}` });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setName(agent.name);
    setEmoji(agent.emoji);
    setRole(agent.role);
    setDescription(agent.description);
    setEditing(false);
  };

  const runAgentAction = async (action: "wake" | "check-in") => {
    setActionRunning(action);
    setActionResult(null);

    try {
      const res = await fetch("/api/team/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: agent.id, action }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || `Failed to run ${action}`);
      }

      setActionResult({
        action,
        text: typeof data.text === "string" ? data.text : "done",
        durationMs: typeof data.durationMs === "number" ? data.durationMs : null,
        model: typeof data.model === "string" ? data.model : null,
        sessionId: typeof data.sessionId === "string" ? data.sessionId : null,
        timestamp: typeof data.timestamp === "string" ? data.timestamp : null,
      });
      onUpdate?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setActionResult({ action, text: `error: ${message}` });
    } finally {
      setActionRunning(null);
    }
  };

  const inputStyle: React.CSSProperties = {
    backgroundColor: "var(--surface-elevated)",
    border: "1px solid var(--border)",
    color: "var(--text-primary)",
    borderRadius: "0.5rem",
    fontSize: "0.875rem",
    padding: "0.375rem 0.5rem",
    width: "100%",
    outline: "none",
  };

  const actionDetailParts: string[] = [];
  if (actionResult?.model) actionDetailParts.push(`model ${formatModel(actionResult.model)}`);
  if (actionResult?.sessionId) actionDetailParts.push(`session ${actionResult.sessionId.slice(0, 8)}`);
  if (typeof actionResult?.durationMs === "number") {
    actionDetailParts.push(`${Math.max(1, Math.round(actionResult.durationMs / 1000))}s`);
  }
  const actionTime = formatActionTime(actionResult?.timestamp);
  if (actionTime) actionDetailParts.push(actionTime);

  return (
    <div
      className="rounded-xl overflow-hidden transition-all duration-200 hover:scale-[1.02] relative"
      style={{
        backgroundColor: "var(--card)",
        border: "1px solid var(--border)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = `${agent.color}60`;
        e.currentTarget.style.boxShadow = `0 4px 20px ${agent.color}15`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div className="p-4 md:p-5">
        {/* Edit overlay */}
        {editing && (
          <div
            className="absolute inset-0 z-10 rounded-xl p-4 md:p-5 flex flex-col gap-3"
            style={{ backgroundColor: "var(--card)" }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                Edit Agent
              </span>
              <button
                onClick={handleCancel}
                className="p-1 rounded-lg transition-colors"
                style={{ color: "var(--text-muted)" }}
                aria-label="Cancel editing"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              style={inputStyle}
              aria-label="Agent name"
            />
            <input
              type="text"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              placeholder="Emoji"
              style={inputStyle}
              aria-label="Agent emoji"
              maxLength={4}
            />
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Role"
              style={inputStyle}
              aria-label="Agent role"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description"
              rows={2}
              style={{ ...inputStyle, resize: "none" }}
              aria-label="Agent description"
            />

            <div className="flex justify-end gap-2 mt-auto">
              <button
                onClick={handleCancel}
                className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                style={{
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border)",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg transition-colors"
                style={{
                  backgroundColor: agent.color,
                  color: "#fff",
                  opacity: saving ? 0.6 : 1,
                }}
              >
                <Save className="w-3 h-3" />
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        )}

        {/* Top row */}
        <div className="flex items-start gap-3 mb-3">
          <div
            className="flex-shrink-0 flex items-center justify-center rounded-xl text-2xl"
            style={{
              width: "48px",
              height: "48px",
              backgroundColor: `${agent.color}20`,
              border: `2px solid ${agent.color}40`,
            }}
          >
            {agent.emoji}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3
                className="text-base font-bold truncate"
                style={{
                  fontFamily: "var(--font-heading)",
                  color: "var(--text-primary)",
                }}
              >
                {agent.name}
              </h3>
              {agent.specialBadge && (
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                  style={{
                    backgroundColor: `${agent.color}25`,
                    color: agent.color,
                    border: `1px solid ${agent.color}40`,
                  }}
                >
                  {agent.specialBadge}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-sm" style={{ color: agent.color, fontWeight: 500 }}>
                {agent.role}
              </p>
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-md"
                style={{
                  color: presence.color,
                  border: `1px solid ${presence.color}55`,
                  backgroundColor: `${presence.color}15`,
                }}
              >
                {presence.label}
              </span>
            </div>
          </div>

          <div
            className="flex-shrink-0 w-2.5 h-2.5 rounded-full mt-1"
            style={{
              backgroundColor: presence.color,
              boxShadow: presence.glow,
            }}
          />
        </div>

        <p className="text-sm mb-3 line-clamp-2" style={{ color: "var(--text-secondary)" }}>
          {agent.description}
        </p>

        <div className="flex flex-wrap gap-1.5 mb-3">
          {agent.tags.map((tag) => (
            <span
              key={tag.label}
              className="text-[10px] font-semibold px-2 py-0.5 rounded"
              style={{
                backgroundColor: `color-mix(in srgb, ${tag.color} 15%, transparent)`,
                color: tag.color,
              }}
            >
              {tag.label}
            </span>
          ))}
        </div>

        <div className="flex items-start justify-between gap-3">
          <div className="text-[11px] leading-tight" style={{ color: "var(--text-muted)" }}>
            <p>
              model:{" "}
              <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>
                {formatModel(agent.model)}
              </span>
            </p>
            <p>
              workspace:{" "}
              <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>
                {formatWorkspace(agent.workspace)}
              </span>
            </p>
            <p>
              live sessions:{" "}
              <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>
                {agent.activeSessions ?? 0}
              </span>
            </p>
            <p>
              last active:{" "}
              <span style={{ color: "var(--text-secondary)", fontWeight: 600 }}>
                {formatLastActive(agent.lastActiveAt)}
              </span>
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => runAgentAction("wake")}
                disabled={Boolean(actionRunning) || editing}
                className="text-[11px] px-2 py-1 rounded-md"
                style={{
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border)",
                  opacity: actionRunning ? 0.6 : 1,
                }}
              >
                {actionRunning === "wake" ? "waking..." : "wake"}
              </button>

              <button
                onClick={() => runAgentAction("check-in")}
                disabled={Boolean(actionRunning) || editing}
                className="text-[11px] px-2 py-1 rounded-md"
                style={{
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border)",
                  opacity: actionRunning ? 0.6 : 1,
                }}
              >
                {actionRunning === "check-in" ? "checking..." : "check-in"}
              </button>

              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1 text-xs transition-colors"
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "var(--text-secondary)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "var(--text-muted)";
                }}
              >
                <Edit3 className="w-3 h-3" />
                edit {agent.id}
              </button>
            </div>

            {actionResult && (
              <div className="text-[11px] max-w-[290px] text-right" style={{ color: "var(--text-muted)", lineHeight: 1.35 }}>
                <p title={actionResult.text}>
                  {actionResult.action}: {actionResult.text}
                </p>
                {actionDetailParts.length > 0 && <p>{actionDetailParts.join(" · ")}</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
