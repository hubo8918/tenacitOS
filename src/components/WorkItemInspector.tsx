"use client";

import Link from "next/link";
import { useEffect } from "react";

import {
  ReviewDecisionComposer,
  type ReviewDecision,
  type ReviewDecisionAgentOption,
  type ReviewDecisionSubmitPayload,
} from "@/components/ReviewDecisionComposer";
import { useFetch } from "@/lib/useFetch";
import type { WorkItemHistoryEntry, WorkItemKind, WorkItemSummary } from "@/lib/work-item-types";

interface WorkItemInspectorData {
  item: WorkItemSummary | null;
  history: WorkItemHistoryEntry[];
}

interface WorkItemInspectorProps {
  kind?: WorkItemKind | null;
  itemId?: string | null;
  projectId?: string | null;
  agentOptions: ReviewDecisionAgentOption[];
  refreshNonce?: number;
  packetActions?: React.ReactNode;
  defaultHandoffToAgentId?: string | null;
  pendingDecision?: ReviewDecision | null;
  reviewDisabled?: boolean;
  reviewError?: string | null;
  onReviewSubmit?: (payload: ReviewDecisionSubmitPayload) => Promise<void>;
  emptyTitle?: string;
  emptyBody?: string;
}

function formatTimestamp(timestamp?: string | null) {
  if (!timestamp) return "No activity yet";

  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  });
}

function prettyRunStatus(value?: string | null) {
  if (!value) return "Idle";
  return value.replace(/_/g, " ");
}

function findAgentName(agentOptions: ReviewDecisionAgentOption[], agentId?: string | null) {
  if (!agentId) return "Unassigned";
  return agentOptions.find((option) => option.id === agentId)?.name || agentId;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg px-3 py-2" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
      <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      <p className="mt-1 text-sm" style={{ color: "var(--text-primary)" }}>
        {value}
      </p>
    </div>
  );
}

export function WorkItemInspector({
  kind,
  itemId,
  projectId,
  agentOptions,
  refreshNonce = 0,
  packetActions,
  defaultHandoffToAgentId,
  pendingDecision = null,
  reviewDisabled = false,
  reviewError = null,
  onReviewSubmit,
  emptyTitle = "Select a work item",
  emptyBody = "Pick a task or phase to inspect review state, packet history, and next handoff decisions.",
}: WorkItemInspectorProps) {
  const entityUrl =
    kind && itemId
      ? `/api/work-items?view=entity&kind=${encodeURIComponent(kind)}&itemId=${encodeURIComponent(itemId)}${
          projectId ? `&projectId=${encodeURIComponent(projectId)}` : ""
        }`
      : "";
  const { data, loading, error, refetch } = useFetch<WorkItemInspectorData>(
    entityUrl || "/api/work-items?view=entity&kind=task&itemId=__placeholder__",
    {
      fetchOnMount: false,
    }
  );

  useEffect(() => {
    if (entityUrl) {
      refetch();
    }
  }, [entityUrl, refreshNonce, refetch]);

  if (!kind || !itemId) {
    return (
      <div className="rounded-xl p-4" style={{ backgroundColor: "var(--surface-elevated)", border: "1px solid var(--border)" }}>
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {emptyTitle}
        </p>
        <p className="mt-2 text-sm" style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
          {emptyBody}
        </p>
      </div>
    );
  }

  const item = data?.item || null;
  const history = data?.history || [];

  return (
    <div className="space-y-4">
      <section className="rounded-xl p-4" style={{ backgroundColor: "var(--surface-elevated)", border: "1px solid var(--border)" }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Snapshot
            </p>
            <h3 className="mt-1 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
              {item?.title || "Loading item..."}
            </h3>
            {item?.parentTitle && (
              <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
                {item.kind === "task" ? "Project link" : "Project"}: {item.parentTitle}
              </p>
            )}
          </div>
          {item?.deepLink && (
            <Link href={item.deepLink.href} className="text-xs font-semibold" style={{ color: "#0A84FF" }}>
              {item.deepLink.label}
            </Link>
          )}
        </div>

        {loading && !item ? (
          <p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>
            Loading inspector...
          </p>
        ) : error ? (
          <p className="mt-3 text-sm" style={{ color: "var(--status-blocked)" }}>
            {error}
          </p>
        ) : item ? (
          <>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <SummaryRow label="Status" value={prettyRunStatus(item.status)} />
              <SummaryRow label="Run State" value={prettyRunStatus(item.runStatus)} />
              <SummaryRow label="Owner" value={findAgentName(agentOptions, item.ownerAgentId)} />
              <SummaryRow label="Reviewer" value={findAgentName(agentOptions, item.reviewerAgentId)} />
              <SummaryRow label="Handoff" value={findAgentName(agentOptions, item.handoffToAgentId)} />
              <SummaryRow
                label="Latest packet"
                value={formatTimestamp(item.latestRun?.timestamp || item.latestReviewDecision?.timestamp)}
              />
            </div>

            {item.latestReviewDecision && (
              <div
                className="mt-4 rounded-lg px-3 py-3"
                style={{
                  backgroundColor: "var(--card)",
                  border: "1px solid color-mix(in srgb, #0A84FF 20%, var(--border))",
                }}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  Latest review decision
                </p>
                <p className="mt-1 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  {item.latestReviewDecision.decision || "No decision"} at {formatTimestamp(item.latestReviewDecision.timestamp)}
                </p>
                {item.latestReviewDecision.reviewerName && (
                  <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                    Reviewer: {item.latestReviewDecision.reviewerName}
                  </p>
                )}
                {item.latestReviewDecision.handoffTo && (
                  <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                    Handoff to: {item.latestReviewDecision.handoffTo}
                  </p>
                )}
                {item.latestReviewDecision.note && (
                  <p className="mt-2 text-sm" style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
                    {item.latestReviewDecision.note}
                  </p>
                )}
              </div>
            )}
          </>
        ) : null}
      </section>

      <section className="rounded-xl p-4" style={{ backgroundColor: "var(--surface-elevated)", border: "1px solid var(--border)" }}>
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          Review Decision
        </p>
        <p className="mt-2 text-sm" style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
          Keep review, handoff, and blocker reasoning attached to the work item instead of scattering it across pages.
        </p>
        {onReviewSubmit ? (
          <div className="mt-4">
            <ReviewDecisionComposer
              agentOptions={agentOptions}
              defaultHandoffToAgentId={defaultHandoffToAgentId}
              pendingDecision={pendingDecision}
              disabled={reviewDisabled}
              error={reviewError}
              onSubmit={onReviewSubmit}
            />
          </div>
        ) : (
          <p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>
            Review actions are not available for this selection.
          </p>
        )}
      </section>

      <section className="rounded-xl p-4" style={{ backgroundColor: "var(--surface-elevated)", border: "1px solid var(--border)" }}>
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          Packet Actions
        </p>
        <div className="mt-3">{packetActions || <p className="text-sm" style={{ color: "var(--text-muted)" }}>No packet actions for this item.</p>}</div>
      </section>

      <section className="rounded-xl p-4" style={{ backgroundColor: "var(--surface-elevated)", border: "1px solid var(--border)" }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Run History
            </p>
            <p className="mt-2 text-sm" style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
              Agent packets and manual review decisions share one history stream.
            </p>
          </div>
        </div>

        {loading && history.length === 0 ? (
          <p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>
            Loading history...
          </p>
        ) : history.length === 0 ? (
          <p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>
            No runs recorded yet.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {history.map((entry) => (
              <div key={entry.id} className="rounded-lg px-3 py-3" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                    {entry.itemKind}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                    {entry.itemKind === "phase" ? "Phase" : "Task"} run
                  </span>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ color: "#0A84FF", backgroundColor: "color-mix(in srgb, #0A84FF 12%, transparent)" }}>
                    {prettyRunStatus(entry.runStatus)}
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  {formatTimestamp(entry.timestamp)}
                </p>
                {entry.deliverable && (
                  <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
                    {entry.deliverable}
                  </p>
                )}
                {entry.text && (
                  <p className="mt-2 text-sm" style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
                    {entry.text}
                  </p>
                )}
                {entry.fields && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {entry.fields.decision && (
                      <span className="rounded-full px-2 py-1 text-[10px] font-medium" style={{ color: "#32D74B", backgroundColor: "color-mix(in srgb, #32D74B 12%, transparent)" }}>
                        {entry.fields.decision}
                      </span>
                    )}
                    {entry.fields.handoffTo && (
                      <span className="rounded-full px-2 py-1 text-[10px] font-medium" style={{ color: "#0A84FF", backgroundColor: "color-mix(in srgb, #0A84FF 12%, transparent)" }}>
                        Handoff: {entry.fields.handoffTo}
                      </span>
                    )}
                    {entry.fields.reviewerName && (
                      <span className="rounded-full px-2 py-1 text-[10px] font-medium" style={{ color: "#64D2FF", backgroundColor: "color-mix(in srgb, #64D2FF 12%, transparent)" }}>
                        Reviewer: {entry.fields.reviewerName}
                      </span>
                    )}
                    {entry.fields.blockers && (
                      <span className="rounded-full px-2 py-1 text-[10px] font-medium" style={{ color: "#FF9F0A", backgroundColor: "color-mix(in srgb, #FF9F0A 12%, transparent)" }}>
                        Blockers noted
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
