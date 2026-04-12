"use client";

import { useMemo, useState } from "react";

export type ReviewDecision = "approve" | "rework" | "block";

export interface ReviewDecisionAgentOption {
  id: string;
  name: string;
  emoji?: string;
  color?: string;
}

export interface ReviewDecisionSubmitPayload {
  decision: ReviewDecision;
  note?: string;
  handoffTo?: string;
}

interface ReviewDecisionComposerProps {
  agentOptions: ReviewDecisionAgentOption[];
  defaultHandoffToAgentId?: string | null;
  pendingDecision?: ReviewDecision | null;
  disabled?: boolean;
  error?: string | null;
  onSubmit: (payload: ReviewDecisionSubmitPayload) => Promise<void> | void;
  approveLabel?: string;
  reworkLabel?: string;
  blockLabel?: string;
}

const DECISION_STYLE: Record<
  ReviewDecision,
  {
    buttonLabel: string;
    activeLabel: string;
    color: string;
    noteLabel: string;
    notePlaceholder: string;
    noteRequired: boolean;
  }
> = {
  approve: {
    buttonLabel: "Approve",
    activeLabel: "Approve",
    color: "#32D74B",
    noteLabel: "Approval note",
    notePlaceholder: "Optional context for the approval or next handoff",
    noteRequired: false,
  },
  rework: {
    buttonLabel: "Send to rework",
    activeLabel: "Rework",
    color: "#FF9F0A",
    noteLabel: "Rework note",
    notePlaceholder: "Required: explain what should change before this comes back for review",
    noteRequired: true,
  },
  block: {
    buttonLabel: "Mark blocked",
    activeLabel: "Block",
    color: "#FF453A",
    noteLabel: "Block note",
    notePlaceholder: "Required: explain what is blocked and what needs to unblock it",
    noteRequired: true,
  },
};

export function ReviewDecisionComposer({
  agentOptions,
  defaultHandoffToAgentId = "",
  pendingDecision = null,
  disabled = false,
  error,
  onSubmit,
  approveLabel,
  reworkLabel,
  blockLabel,
}: ReviewDecisionComposerProps) {
  const [activeDecision, setActiveDecision] = useState<ReviewDecision | null>(null);
  const [note, setNote] = useState("");
  const [handoffToAgentId, setHandoffToAgentId] = useState(defaultHandoffToAgentId || "");
  const [localError, setLocalError] = useState<string | null>(null);

  const activeConfig = activeDecision ? DECISION_STYLE[activeDecision] : null;
  const canEdit = !disabled && !pendingDecision;
  const submitError = localError || error || null;
  const normalizedAgentOptions = useMemo(
    () =>
      agentOptions
        .filter((option) => option.id)
        .sort((left, right) => left.name.localeCompare(right.name)),
    [agentOptions]
  );

  const openComposer = (decision: ReviewDecision) => {
    if (!canEdit) return;

    setActiveDecision(decision);
    setNote("");
    setHandoffToAgentId(defaultHandoffToAgentId || "");
    setLocalError(null);
  };

  const closeComposer = () => {
    if (pendingDecision) return;
    setActiveDecision(null);
    setNote("");
    setHandoffToAgentId(defaultHandoffToAgentId || "");
    setLocalError(null);
  };

  const handleSubmit = async () => {
    if (!activeDecision || !activeConfig) return;

    const trimmedNote = note.trim();
    if (activeConfig.noteRequired && !trimmedNote) {
      setLocalError(
        activeDecision === "block"
          ? "Add a block note before saving this review decision."
          : "Add a rework note before sending this back."
      );
      return;
    }

    setLocalError(null);

    try {
      await onSubmit({
        decision: activeDecision,
        note: trimmedNote || undefined,
        handoffTo:
          activeDecision === "block" ? undefined : handoffToAgentId || undefined,
      });
      closeComposer();
    } catch {
      // Parent owns the surfaced error message; keep the composer open.
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => openComposer("approve")}
          disabled={!canEdit}
          className="text-[11px] font-medium px-3 py-1.5 rounded-lg transition-colors"
          style={{
            color: DECISION_STYLE.approve.color,
            border: `1px solid color-mix(in srgb, ${DECISION_STYLE.approve.color} 28%, transparent)`,
            backgroundColor:
              activeDecision === "approve"
                ? `color-mix(in srgb, ${DECISION_STYLE.approve.color} 12%, transparent)`
                : "transparent",
            opacity: !canEdit ? 0.6 : 1,
          }}
        >
          {pendingDecision === "approve"
            ? "Approving..."
            : approveLabel || DECISION_STYLE.approve.buttonLabel}
        </button>
        <button
          type="button"
          onClick={() => openComposer("rework")}
          disabled={!canEdit}
          className="text-[11px] font-medium px-3 py-1.5 rounded-lg transition-colors"
          style={{
            color: DECISION_STYLE.rework.color,
            border: `1px solid color-mix(in srgb, ${DECISION_STYLE.rework.color} 28%, transparent)`,
            backgroundColor:
              activeDecision === "rework"
                ? `color-mix(in srgb, ${DECISION_STYLE.rework.color} 12%, transparent)`
                : "transparent",
            opacity: !canEdit ? 0.6 : 1,
          }}
        >
          {pendingDecision === "rework"
            ? "Routing rework..."
            : reworkLabel || DECISION_STYLE.rework.buttonLabel}
        </button>
        <button
          type="button"
          onClick={() => openComposer("block")}
          disabled={!canEdit}
          className="text-[11px] font-medium px-3 py-1.5 rounded-lg transition-colors"
          style={{
            color: DECISION_STYLE.block.color,
            border: `1px solid color-mix(in srgb, ${DECISION_STYLE.block.color} 28%, transparent)`,
            backgroundColor:
              activeDecision === "block"
                ? `color-mix(in srgb, ${DECISION_STYLE.block.color} 12%, transparent)`
                : "transparent",
            opacity: !canEdit ? 0.6 : 1,
          }}
        >
          {pendingDecision === "block"
            ? "Marking blocked..."
            : blockLabel || DECISION_STYLE.block.buttonLabel}
        </button>
      </div>

      {activeConfig && (
        <div
          className="rounded-lg p-3 space-y-3"
          style={{
            border: `1px solid color-mix(in srgb, ${activeConfig.color} 28%, transparent)`,
            backgroundColor: `color-mix(in srgb, ${activeConfig.color} 10%, transparent)`,
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold" style={{ color: activeConfig.color }}>
              {activeConfig.activeLabel} review decision
            </p>
            <button
              type="button"
              onClick={closeComposer}
              disabled={Boolean(pendingDecision)}
              className="text-[10px] font-medium px-2.5 py-1 rounded-full"
              style={{
                color: "var(--text-secondary)",
                border: "1px solid var(--border)",
                opacity: pendingDecision ? 0.6 : 1,
              }}
            >
              Cancel
            </button>
          </div>

          <label className="flex flex-col gap-1 text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>
            {activeConfig.noteLabel}
            <textarea
              value={note}
              onChange={(event) => {
                setNote(event.target.value);
                setLocalError(null);
              }}
              rows={3}
              placeholder={activeConfig.notePlaceholder}
              className="rounded-lg px-3 py-2 text-sm"
              style={{
                backgroundColor: "var(--card)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
                resize: "vertical",
              }}
            />
          </label>

          {activeDecision !== "block" && (
            <label
              className="flex flex-col gap-1 text-[11px] font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              Handoff target override
              <select
                value={handoffToAgentId}
                onChange={(event) => setHandoffToAgentId(event.target.value)}
                className="rounded-lg px-3 py-2 text-sm"
                style={{
                  backgroundColor: "var(--card)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border)",
                }}
              >
                <option value="">No handoff planned</option>
                {normalizedAgentOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.emoji ? `${option.emoji} ` : ""}
                    {option.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {submitError && (
            <p className="text-[11px] font-medium" style={{ color: "var(--status-blocked)" }}>
              {submitError}
            </p>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={Boolean(pendingDecision) || disabled}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-lg"
              style={{
                color: "#111",
                backgroundColor: activeConfig.color,
                opacity: pendingDecision || disabled ? 0.6 : 1,
              }}
            >
              {pendingDecision === activeDecision
                ? "Saving decision..."
                : `Save ${activeConfig.activeLabel.toLowerCase()} decision`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
