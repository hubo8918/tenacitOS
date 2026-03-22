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
  reportsTo?: string;
  canReviewFor?: string[];
  canDelegateTo?: string[];
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
  allAgents: Pick<TeamAgent, "id" | "name">[];
  onUpdate?: () => void;
}

type PresenceState = "active" | "idle" | "never";
type TeamTier = "leadership" | "operations" | "io" | "meta";

function defaultTagColor(label: string): string {
  const normalized = label.trim().toLowerCase();

  if (normalized.includes("lead") || normalized.includes("manager")) return "#A855F7";
  if (normalized.includes("ops") || normalized.includes("infra")) return "#0A84FF";
  if (normalized.includes("design") || normalized.includes("ux")) return "#EC4899";
  if (normalized.includes("data") || normalized.includes("analytics")) return "#14B8A6";
  if (normalized.includes("product") || normalized.includes("project")) return "#F59E0B";
  return "#8B5CF6";
}

function parseTagsInput(raw: string, existingTags: TeamAgent["tags"]): TeamAgent["tags"] {
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((label) => {
      const existing = existingTags.find((tag) => tag.label.toLowerCase() === label.toLowerCase());
      return {
        label,
        color: existing?.color || defaultTagColor(label),
      };
    });
}

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

function actionLabel(action: AgentActionResult["action"]): string {
  return action === "wake" ? "ready ping" : "quick check-in";
}

export function AgentCard({ agent, allAgents, onUpdate }: AgentCardProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(agent.name);
  const [emoji, setEmoji] = useState(agent.emoji);
  const [role, setRole] = useState(agent.role);
  const [description, setDescription] = useState(agent.description);
  const [tier, setTier] = useState<TeamTier>(agent.tier as TeamTier);
  const [specialBadge, setSpecialBadge] = useState(agent.specialBadge || "");
  const [reportsTo, setReportsTo] = useState(agent.reportsTo || "");
  const [canReviewFor, setCanReviewFor] = useState<string[]>(agent.canReviewFor || []);
  const [canDelegateTo, setCanDelegateTo] = useState<string[]>(agent.canDelegateTo || []);
  const [tagsInput, setTagsInput] = useState(agent.tags.map((tag) => tag.label).join(", "));
  const [saving, setSaving] = useState(false);
  const [actionRunning, setActionRunning] = useState<"wake" | "check-in" | null>(null);
  const [actionResult, setActionResult] = useState<AgentActionResult | null>(null);

  const presence = getPresenceMeta(getPresenceState(agent));
  const relationshipOptions = allAgents.filter((candidate) => candidate.id !== agent.id);
  const reportOptions = relationshipOptions;
  const reviewOptions = relationshipOptions;
  const delegateOptions = relationshipOptions;
  const reportsToName = allAgents.find((candidate) => candidate.id === agent.reportsTo)?.name || agent.reportsTo;
  const reviewForNames = (agent.canReviewFor || [])
    .map((candidateId) => allAgents.find((candidate) => candidate.id === candidateId)?.name || candidateId)
    .filter(Boolean);
  const delegateToNames = (agent.canDelegateTo || [])
    .map((candidateId) => allAgents.find((candidate) => candidate.id === candidateId)?.name || candidateId)
    .filter(Boolean);

  const toggleReviewTarget = (agentId: string) => {
    setCanReviewFor((current) =>
      current.includes(agentId)
        ? current.filter((value) => value !== agentId)
        : [...current, agentId]
    );
  };

  const toggleDelegateTarget = (agentId: string) => {
    setCanDelegateTo((current) =>
      current.includes(agentId)
        ? current.filter((value) => value !== agentId)
        : [...current, agentId]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/team", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: agent.id,
          name,
          emoji,
          role,
          description,
          tier,
          specialBadge: specialBadge.trim() || null,
          reportsTo: reportsTo || null,
          canReviewFor,
          canDelegateTo,
          tags: parseTagsInput(tagsInput, agent.tags),
        }),
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
    setTier(agent.tier as TeamTier);
    setSpecialBadge(agent.specialBadge || "");
    setReportsTo(agent.reportsTo || "");
    setCanReviewFor(agent.canReviewFor || []);
    setCanDelegateTo(agent.canDelegateTo || []);
    setTagsInput(agent.tags.map((tag) => tag.label).join(", "));
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
            className="absolute inset-0 z-10 rounded-xl p-4 md:p-5 flex flex-col gap-3 overflow-y-auto"
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
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value as TeamTier)}
              style={inputStyle}
              aria-label="Agent tier"
            >
              <option value="leadership">Leadership</option>
              <option value="operations">Operations</option>
              <option value="io">Input / Output</option>
              <option value="meta">Meta</option>
            </select>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description"
              rows={2}
              style={{ ...inputStyle, resize: "none" }}
              aria-label="Agent description"
            />
            <input
              type="text"
              value={specialBadge}
              onChange={(e) => setSpecialBadge(e.target.value)}
              placeholder="Badge (optional)"
              style={inputStyle}
              aria-label="Agent badge"
            />
            <select
              value={reportsTo}
              onChange={(e) => setReportsTo(e.target.value)}
              style={inputStyle}
              aria-label="Agent manager"
            >
              <option value="">Top-level / no manager</option>
              {reportOptions.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </option>
              ))}
            </select>
            <div>
              <div className="text-[11px] mb-1" style={{ color: "var(--text-muted)" }}>
                Can review for
              </div>
              <div
                className="rounded-lg p-2 space-y-1.5"
                style={{
                  backgroundColor: "var(--surface-elevated)",
                  border: "1px solid var(--border)",
                }}
              >
                {reviewOptions.length > 0 ? (
                  reviewOptions.map((candidate) => (
                    <label
                      key={candidate.id}
                      className="flex items-center gap-2 text-xs"
                      style={{ color: "var(--text-primary)" }}
                    >
                      <input
                        type="checkbox"
                        checked={canReviewFor.includes(candidate.id)}
                        onChange={() => toggleReviewTarget(candidate.id)}
                      />
                      <span>{candidate.name}</span>
                    </label>
                  ))
                ) : (
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    No other agents available.
                  </p>
                )}
              </div>
            </div>
            <div>
              <div className="text-[11px] mb-1" style={{ color: "var(--text-muted)" }}>
                Can delegate to
              </div>
              <div
                className="rounded-lg p-2 space-y-1.5"
                style={{
                  backgroundColor: "var(--surface-elevated)",
                  border: "1px solid var(--border)",
                }}
              >
                {delegateOptions.length > 0 ? (
                  delegateOptions.map((candidate) => (
                    <label
                      key={candidate.id}
                      className="flex items-center gap-2 text-xs"
                      style={{ color: "var(--text-primary)" }}
                    >
                      <input
                        type="checkbox"
                        checked={canDelegateTo.includes(candidate.id)}
                        onChange={() => toggleDelegateTarget(candidate.id)}
                      />
                      <span>{candidate.name}</span>
                    </label>
                  ))
                ) : (
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    No other agents available.
                  </p>
                )}
              </div>
            </div>
            <textarea
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="Tags, comma separated"
              rows={2}
              style={{ ...inputStyle, resize: "none" }}
              aria-label="Agent tags"
            />
            <p className="text-[11px] -mt-1" style={{ color: "var(--text-muted)", lineHeight: 1.4 }}>
              Use tags for specialties, domain ownership, or collaboration context — for example: backend, product, infra.
            </p>
            <p className="text-[11px] -mt-1" style={{ color: "var(--text-muted)", lineHeight: 1.4 }}>
              Reporting line is organizational metadata for Mission Control, not an execution permission rule.
            </p>
            <p className="text-[11px] -mt-1" style={{ color: "var(--text-muted)", lineHeight: 1.4 }}>
              Review coverage is also planning metadata: who this agent is a good reviewer for, not a runtime ACL.
            </p>
            <p className="text-[11px] -mt-1" style={{ color: "var(--text-muted)", lineHeight: 1.4 }}>
              Delegation targets describe likely handoff paths in Mission Control, not an enforced spawn/permission rule.
            </p>

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

        {(reportsToName || reviewForNames.length > 0 || delegateToNames.length > 0) && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {reportsToName && (
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded"
                style={{
                  backgroundColor: `${agent.color}12`,
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border)",
                }}
              >
                reports to {reportsToName}
              </span>
            )}
            {reviewForNames.length > 0 && (
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded"
                style={{
                  backgroundColor: `${agent.color}12`,
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border)",
                }}
              >
                reviews for {reviewForNames.join(", ")}
              </span>
            )}
            {delegateToNames.length > 0 && (
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded"
                style={{
                  backgroundColor: `${agent.color}12`,
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border)",
                }}
              >
                delegates to {delegateToNames.join(", ")}
              </span>
            )}
          </div>
        )}

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
                {actionRunning === "wake" ? "prompting..." : "ready ping"}
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
                {actionRunning === "check-in" ? "checking..." : "quick check-in"}
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

            <p className="text-[10px] max-w-[290px] text-right" style={{ color: "var(--text-muted)", lineHeight: 1.35 }}>
              One-off prompts only. These do not change runtime state.
            </p>

            {actionResult && (
              <div className="text-[11px] max-w-[290px] text-right" style={{ color: "var(--text-muted)", lineHeight: 1.35 }}>
                <p title={actionResult.text}>
                  {actionLabel(actionResult.action)}: {actionResult.text}
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
