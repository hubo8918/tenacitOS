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
}

interface AgentCardProps {
  agent: TeamAgent;
  onUpdate?: () => void;
}

export function AgentCard({ agent, onUpdate }: AgentCardProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(agent.name);
  const [emoji, setEmoji] = useState(agent.emoji);
  const [role, setRole] = useState(agent.role);
  const [description, setDescription] = useState(agent.description);
  const [status, setStatus] = useState<"online" | "offline">(agent.status);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/team", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: agent.id, name, emoji, role, description, status }),
      });
      setEditing(false);
      onUpdate?.();
    } catch (err) {
      console.error("Failed to update agent:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setName(agent.name);
    setEmoji(agent.emoji);
    setRole(agent.role);
    setDescription(agent.description);
    setStatus(agent.status);
    setEditing(false);
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

  return (
    <div
      className="rounded-xl overflow-hidden transition-all duration-200 hover:scale-[1.02] relative"
      style={{
        backgroundColor: "var(--card)",
        border: "1px solid var(--border)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = agent.color + "60";
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
              <span
                className="text-sm font-bold"
                style={{ color: "var(--text-primary)" }}
              >
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
            <div className="flex items-center gap-2">
              <span
                className="text-xs"
                style={{ color: "var(--text-secondary)" }}
              >
                Status:
              </span>
              <button
                onClick={() =>
                  setStatus((s) => (s === "online" ? "offline" : "online"))
                }
                className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg transition-colors"
                style={{
                  backgroundColor: "var(--surface-elevated)",
                  border: "1px solid var(--border)",
                  color:
                    status === "online" ? "#4ade80" : "var(--text-muted)",
                }}
                aria-label={`Toggle status, currently ${status}`}
              >
                <div
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor:
                      status === "online" ? "#4ade80" : "#6b7280",
                  }}
                />
                {status === "online" ? "Online" : "Offline"}
              </button>
            </div>
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

        {/* Top row: avatar + name + status */}
        <div className="flex items-start gap-3 mb-3">
          {/* Avatar */}
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

          {/* Name, role, status */}
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
            <p
              className="text-sm"
              style={{ color: agent.color, fontWeight: 500 }}
            >
              {agent.role}
            </p>
          </div>

          {/* Status dot */}
          <div
            className="flex-shrink-0 w-2.5 h-2.5 rounded-full mt-1"
            style={{
              backgroundColor: agent.status === "online" ? "#4ade80" : "#6b7280",
              boxShadow: agent.status === "online" ? "0 0 6px #4ade8060" : "none",
            }}
          />
        </div>

        {/* Description */}
        <p
          className="text-sm mb-3 line-clamp-2"
          style={{ color: "var(--text-secondary)" }}
        >
          {agent.description}
        </p>

        {/* Tags */}
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

        {/* Footer: edit link */}
        <div className="flex justify-end">
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
      </div>
    </div>
  );
}
