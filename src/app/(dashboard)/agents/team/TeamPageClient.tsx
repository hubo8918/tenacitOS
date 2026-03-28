"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { ReviewDecisionComposer, type ReviewDecisionSubmitPayload } from "@/components/ReviewDecisionComposer";
import type { TeamAgent } from "@/data/mockTeamData";
import { useFetch } from "@/lib/useFetch";
import type { WorkItemDashboardData, WorkItemSummary } from "@/lib/work-item-types";

const AgentCard = dynamic(() => import("@/components/AgentCard").then((mod) => mod.AgentCard));

type ActivityFilter = "all" | "active" | "idle" | "never";
type TierFilter = "all" | TeamAgent["tier"];
type TeamView = "inbox" | "agents";

const REVIEW_FOCUS_ALL = "__all__";
const REVIEW_FOCUS_UNASSIGNED = "__unassigned__";

function getActivityState(agent: TeamAgent): Exclude<ActivityFilter, "all"> {
  if ((agent.activeSessions ?? 0) > 0) return "active";
  if (agent.lastActiveAt) return "idle";
  return "never";
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

function describeReviewFocus(focus: string, agents: TeamAgent[]) {
  if (focus === REVIEW_FOCUS_ALL) return "All review items";
  if (focus === REVIEW_FOCUS_UNASSIGNED) return "Unassigned review items";
  return `${agents.find((agent) => agent.id === focus)?.name || "Selected reviewer"}'s queue`;
}

export default function TeamPageClient({
  initialTeam,
  initialDashboard,
  initialReviewFocus,
  initialView,
}: {
  initialTeam: TeamAgent[];
  initialDashboard: WorkItemDashboardData;
  initialReviewFocus: string;
  initialView: TeamView;
}) {
  const [view, setView] = useState<TeamView>(initialView);
  const [reviewFocus, setReviewFocus] = useState(initialReviewFocus);
  const [query, setQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [reviewActionPendingKey, setReviewActionPendingKey] = useState<string | null>(null);
  const [reviewActionErrorKey, setReviewActionErrorKey] = useState<string | null>(null);
  const [reviewActionError, setReviewActionError] = useState<string | null>(null);

  const { data, loading, error, refetch } = useFetch<{ team: TeamAgent[] }>("/api/team", {
    timeoutMs: 10_000,
    initialData: initialTeam.length > 0 ? { team: initialTeam } : null,
    fetchOnMount: initialTeam.length === 0,
  });

  const teamAgents = useMemo(() => data?.team || [], [data]);
  const defaultReviewFocus = useMemo(
    () => teamAgents.find((agent) => agent.id === "henry")?.id || teamAgents[0]?.id || REVIEW_FOCUS_ALL,
    [teamAgents]
  );
  const effectiveReviewFocus =
    reviewFocus === REVIEW_FOCUS_ALL ||
    reviewFocus === REVIEW_FOCUS_UNASSIGNED ||
    teamAgents.some((agent) => agent.id === reviewFocus)
      ? reviewFocus || defaultReviewFocus
      : defaultReviewFocus;

  const initialDashboardUrl = `/api/work-items?view=bootstrap&reviewer=${encodeURIComponent(initialReviewFocus)}&limit=6`;
  const dashboardUrl = `/api/work-items?view=bootstrap&reviewer=${encodeURIComponent(effectiveReviewFocus)}&limit=6`;
  const {
    data: dashboardData,
    loading: dashboardLoading,
    error: dashboardError,
    refetch: refetchDashboard,
  } = useFetch<WorkItemDashboardData>(dashboardUrl, {
    initialData: initialDashboard,
    fetchOnMount: false,
  });
  const didHydrateDashboardRef = useRef(false);

  useEffect(() => {
    if (!dashboardUrl) return;

    if (!didHydrateDashboardRef.current && dashboardUrl === initialDashboardUrl) {
      didHydrateDashboardRef.current = true;
      return;
    }

    didHydrateDashboardRef.current = true;
    refetchDashboard();
  }, [dashboardUrl, initialDashboardUrl, refetchDashboard]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      refetch();
      if (view === "inbox") {
        refetchDashboard();
      }
    }, 30_000);

    return () => window.clearInterval(timer);
  }, [refetch, refetchDashboard, view]);

  const filteredAgents = useMemo(() => {
    const loweredQuery = query.trim().toLowerCase();

    return teamAgents.filter((agent) => {
      if (tierFilter !== "all" && agent.tier !== tierFilter) return false;
      const activityState = getActivityState(agent);
      if (activityFilter !== "all" && activityState !== activityFilter) return false;
      if (!loweredQuery) return true;

      return [agent.name, agent.role, agent.description, agent.id]
        .join(" ")
        .toLowerCase()
        .includes(loweredQuery);
    });
  }, [activityFilter, query, teamAgents, tierFilter]);

  const inboxItems = dashboardData?.items || [];
  const recentDecisions = dashboardData?.decisions || [];
  const unassignedCount = dashboardData?.counts.unassigned || 0;
  const hasInboxRoutingGap = inboxItems.length === 0 && unassignedCount > 0;

  const handleReviewDecision = async (
    item: WorkItemSummary,
    payload: ReviewDecisionSubmitPayload
  ) => {
    const key = `${item.kind}:${item.parentId || "root"}:${item.id}`;
    setReviewActionPendingKey(key);
    setReviewActionErrorKey(null);
    setReviewActionError(null);

    try {
      const response = await fetch("/api/work-items/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: item.kind,
          itemId: item.id,
          projectId: item.kind === "phase" ? item.parentId : undefined,
          decision: payload.decision,
          note: payload.note,
          handoffTo: payload.handoffTo,
        }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(body?.error || "Failed to save review decision");
      }

      refetchDashboard();
    } catch (reviewError) {
      setReviewActionErrorKey(key);
      setReviewActionError(reviewError instanceof Error ? reviewError.message : "Failed to save review decision");
      throw reviewError instanceof Error ? reviewError : new Error("Failed to save review decision");
    } finally {
      setReviewActionPendingKey(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Mission Control
          </p>
          <h1 className="mt-1 text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
            Team
          </h1>
          <p className="mt-2 max-w-3xl text-sm" style={{ color: "var(--text-muted)", lineHeight: 1.7 }}>
            Use Inbox for review and handoff operations. Use Agents for profile and capability maintenance.
          </p>
        </div>

        <div className="inline-flex rounded-xl p-1" style={{ backgroundColor: "var(--surface-elevated)", border: "1px solid var(--border)" }}>
          {(["inbox", "agents"] as TeamView[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setView(option)}
              className="rounded-lg px-4 py-2 text-sm font-semibold capitalize transition-colors"
              style={{
                backgroundColor: view === option ? "var(--card)" : "transparent",
                color: view === option ? "var(--text-primary)" : "var(--text-secondary)",
              }}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {view === "inbox" ? (
        <div className="space-y-4">
          <div className="rounded-xl p-4" style={{ backgroundColor: "var(--surface-elevated)", border: "1px solid var(--border)" }}>
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  Unified review inbox
                </p>
                <p className="mt-1 text-sm" style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
                  {describeReviewFocus(effectiveReviewFocus, teamAgents)}
                </p>
              </div>
              <label className="ml-auto flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                Reviewer focus
                <select value={effectiveReviewFocus} onChange={(event) => setReviewFocus(event.target.value)} className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "var(--card)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                  <option value={REVIEW_FOCUS_ALL}>All review items</option>
                  <option value={REVIEW_FOCUS_UNASSIGNED}>Unassigned review items</option>
                  {teamAgents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-lg px-3 py-2" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  Total
                </p>
                <p className="mt-1 text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
                  {dashboardData?.counts.total || 0}
                </p>
              </div>
              <div className="rounded-lg px-3 py-2" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  Tasks
                </p>
                <p className="mt-1 text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
                  {dashboardData?.counts.task || 0}
                </p>
              </div>
              <div className="rounded-lg px-3 py-2" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  Phases
                </p>
                <p className="mt-1 text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
                  {dashboardData?.counts.phase || 0}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReviewFocus(REVIEW_FOCUS_UNASSIGNED)}
                className="rounded-lg px-3 py-2 text-left"
                style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  Unassigned
                </p>
                <p className="mt-1 text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
                  {dashboardData?.counts.unassigned || 0}
                </p>
              </button>
            </div>
          </div>

          {dashboardError && (
            <div className="rounded-xl p-4" style={{ backgroundColor: "var(--surface-elevated)", border: "1px solid var(--border)" }}>
              <p className="text-sm" style={{ color: "var(--status-blocked)" }}>
                {dashboardError}
              </p>
            </div>
          )}

          {unassignedCount > 0 && (
            <div className="rounded-xl p-4" style={{ backgroundColor: "color-mix(in srgb, #0A84FF 10%, var(--surface-elevated))", border: "1px solid color-mix(in srgb, #0A84FF 22%, transparent)" }}>
              <p className="text-sm font-semibold" style={{ color: "#0A84FF" }}>
                {unassignedCount} review item{unassignedCount === 1 ? "" : "s"} still need routing
              </p>
              <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
                If the inbox is quiet, switch the reviewer focus to <code>Unassigned</code> to route work, or assign a reviewer on the related task or phase.
              </p>
            </div>
          )}

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
            <div className="space-y-3">
              {dashboardLoading && inboxItems.length === 0 ? (
                <div className="rounded-xl p-4" style={{ backgroundColor: "var(--surface-elevated)", border: "1px solid var(--border)" }}>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    Loading inbox...
                  </p>
                </div>
              ) : inboxItems.length === 0 ? (
                <div className="rounded-xl p-4" style={{ backgroundColor: "var(--surface-elevated)", border: "1px solid var(--border)" }}>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    {hasInboxRoutingGap ? "No items are waiting for this reviewer right now." : "No items are waiting for review right now."}
                  </p>
                  <p className="mt-2 text-sm" style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
                    If you expected work here, check that tasks or phases have an assigned reviewer and a current
                    <code style={{ marginLeft: "4px", marginRight: "4px" }}>needs_review</code>
                    run status. Use the <code style={{ marginLeft: "4px", marginRight: "4px" }}>Unassigned</code> focus to find items that still need routing.
                  </p>
                </div>
              ) : (
                inboxItems.map((item) => {
                  const key = `${item.kind}:${item.parentId || "root"}:${item.id}`;
                  return (
                    <div key={key} className="rounded-xl p-4" style={{ backgroundColor: "var(--surface-elevated)", border: "1px solid var(--border)" }}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                            {item.title}
                          </p>
                          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
                            {item.kind === "task" ? "Task" : "Phase"} - {item.parentTitle || "No parent"} - reviewer {item.reviewerAgentId || "unassigned"}
                          </p>
                        </div>
                        <Link href={item.deepLink.href} className="text-xs font-semibold" style={{ color: "#0A84FF" }}>
                          Open
                        </Link>
                      </div>

                      {item.latestRun?.deliverable && (
                        <p className="mt-3 text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
                          {item.latestRun.deliverable}
                        </p>
                      )}

                      <div className="mt-3">
                        <ReviewDecisionComposer
                          agentOptions={teamAgents}
                          defaultHandoffToAgentId={item.handoffToAgentId || ""}
                          pendingDecision={null}
                          disabled={reviewActionPendingKey === key}
                          error={reviewActionErrorKey === key ? reviewActionError : null}
                          onSubmit={(payload) => handleReviewDecision(item, payload)}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="rounded-xl p-4" style={{ backgroundColor: "var(--surface-elevated)", border: "1px solid var(--border)" }}>
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Recent review decisions
              </p>
              <p className="mt-1 text-sm" style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
                Keeps the latest decision visible even after an item leaves the active queue.
              </p>

              <div className="mt-4 space-y-3">
                {dashboardLoading && recentDecisions.length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    Loading recent decisions...
                  </p>
                ) : recentDecisions.length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    No review decisions recorded yet.
                  </p>
                ) : (
                  recentDecisions.map((decision) => (
                    <div key={decision.id} className="rounded-lg px-3 py-3" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                            {decision.title}
                          </p>
                          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                            {decision.kind === "task" ? "Task" : "Phase"} - {decision.parentTitle || "No parent"}
                          </p>
                          {decision.reviewerName && (
                            <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                              Reviewed by {decision.reviewerName}
                            </p>
                          )}
                        </div>
                        <Link href={decision.deepLink.href} className="text-xs font-semibold" style={{ color: "#0A84FF" }}>
                          Open
                        </Link>
                      </div>
                      <p className="mt-2 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                        {decision.decision || "No decision"}
                      </p>
                      {decision.handoffTo && (
                        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                          Handoff to: {decision.handoffTo}
                        </p>
                      )}
                      {decision.note && (
                        <p className="mt-2 text-sm" style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
                          {decision.note}
                        </p>
                      )}
                      <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
                        {formatTimestamp(decision.timestamp)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl p-4" style={{ backgroundColor: "var(--surface-elevated)", border: "1px solid var(--border)" }}>
            <div className="grid gap-4 md:grid-cols-3">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search team..."
                className="rounded-lg px-3 py-2 text-sm"
                style={{ backgroundColor: "var(--card)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              />
              <select value={tierFilter} onChange={(event) => setTierFilter(event.target.value as TierFilter)} className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "var(--card)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                <option value="all">All tiers</option>
                <option value="leadership">Leadership</option>
                <option value="operations">Operations</option>
                <option value="io">IO</option>
                <option value="meta">Meta</option>
              </select>
              <select value={activityFilter} onChange={(event) => setActivityFilter(event.target.value as ActivityFilter)} className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "var(--card)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                <option value="all">All activity</option>
                <option value="active">Active</option>
                <option value="idle">Idle</option>
                <option value="never">Never</option>
              </select>
            </div>
            {error && (
              <p className="mt-3 text-sm" style={{ color: "var(--status-blocked)" }}>
                {error}
              </p>
            )}
          </div>

          {loading && filteredAgents.length === 0 ? (
            <div className="rounded-xl p-4" style={{ backgroundColor: "var(--surface-elevated)", border: "1px solid var(--border)" }}>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Loading team...
              </p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {filteredAgents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  allAgents={teamAgents.map((candidate) => ({ id: candidate.id, name: candidate.name }))}
                  onUpdate={refetch}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
