"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AgentCard } from "@/components/AgentCard";
import {
  ReviewDecisionComposer,
  type ReviewDecision,
  type ReviewDecisionSubmitPayload,
} from "@/components/ReviewDecisionComposer";
import { TierDivider } from "@/components/TierDivider";
import { tierConfig } from "@/data/mockTeamData";
import { useFetch } from "@/lib/useFetch";
import type { TeamAgent } from "@/data/mockTeamData";
import type { Project, ProjectPhase } from "@/data/mockProjectsData";
import type { Task } from "@/data/mockTasksData";

type TierFilter = "all" | TeamAgent["tier"];
type ActivityFilter = "all" | "active" | "idle" | "never";

interface TeamPageClientProps {
  initialTeam: TeamAgent[];
}

interface ReviewPhaseItem {
  projectId: string;
  projectTitle: string;
  phase: ProjectPhase;
}

interface ReviewDecisionItem {
  key: string;
  kind: "task" | "phase";
  title: string;
  context: string;
  href: string;
  timestamp?: string;
  decision: string;
  handoffTo?: string;
  note?: string;
}

interface ReviewAttemptFields {
  decision?: string;
  handoffTo?: string;
  needsFromHuman?: string;
}

interface TaskReviewAttempt {
  id: string;
  taskId: string;
  taskTitle?: string;
  timestamp: string;
  fields?: ReviewAttemptFields | null;
}

interface PhaseReviewAttempt {
  id: string;
  projectId: string;
  projectTitle?: string;
  phaseId: string;
  phaseTitle?: string;
  timestamp: string;
  fields?: ReviewAttemptFields | null;
}

const REVIEW_FOCUS_ALL = "__all__";
const REVIEW_FOCUS_UNASSIGNED = "__unassigned__";

function matchesReviewerFocus(reviewerAgentId: string | undefined, focus: string): boolean {
  if (focus === REVIEW_FOCUS_ALL) return true;
  if (focus === REVIEW_FOCUS_UNASSIGNED) return !reviewerAgentId;
  return reviewerAgentId === focus;
}

function describeReviewFocus(
  focus: string,
  selectedReviewAgent: TeamAgent | null
): string {
  if (focus === REVIEW_FOCUS_ALL) return "All review items";
  if (focus === REVIEW_FOCUS_UNASSIGNED) return "Unassigned review items";
  return selectedReviewAgent ? `${selectedReviewAgent.name}'s review queue` : "Review queue";
}

function decisionTone(decision: string) {
  if (decision === "APPROVED") {
    return {
      color: "#32D74B",
      background: "color-mix(in srgb, #32D74B 14%, transparent)",
      border: "1px solid color-mix(in srgb, #32D74B 28%, transparent)",
    };
  }

  if (decision === "BLOCKED") {
    return {
      color: "#FF453A",
      background: "color-mix(in srgb, #FF453A 14%, transparent)",
      border: "1px solid color-mix(in srgb, #FF453A 28%, transparent)",
    };
  }

  return {
    color: "#FF9F0A",
    background: "color-mix(in srgb, #FF9F0A 14%, transparent)",
    border: "1px solid color-mix(in srgb, #FF9F0A 28%, transparent)",
  };
}

function getActivityState(agent: TeamAgent): Exclude<ActivityFilter, "all"> {
  if ((agent.activeSessions ?? 0) > 0) return "active";
  if (agent.lastActiveAt) return "idle";
  return "never";
}

function describeTeamError(error: string | null): string {
  if (!error) return "Unknown error";
  if (error.startsWith("Request timed out")) {
    return "Team data is temporarily unavailable (request timed out).";
  }
  return error;
}

function formatReviewTimestamp(timestamp?: string | null): string {
  if (!timestamp) return "No packet yet";

  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  });
}

export default function TeamPageClient({ initialTeam }: TeamPageClientProps) {
  const hasInitialTeam = initialTeam.length > 0;

  const { data, loading, error, refetch } = useFetch<{ team: TeamAgent[] }>("/api/team", {
    timeoutMs: 10_000,
    initialData: hasInitialTeam ? { team: initialTeam } : null,
    fetchOnMount: !hasInitialTeam,
  });
  const {
    data: tasksData,
    loading: tasksLoading,
    error: tasksError,
    refetch: refetchTasks,
  } = useFetch<{ tasks: Task[] }>("/api/agent-tasks");
  const {
    data: projectsData,
    loading: projectsLoading,
    error: projectsError,
    refetch: refetchProjects,
  } = useFetch<{ projects: Project[] }>("/api/projects");
  const {
    data: taskReviewHistoryData,
    loading: taskReviewHistoryLoading,
    error: taskReviewHistoryError,
    refetch: refetchTaskReviewHistory,
  } = useFetch<{ attempts: TaskReviewAttempt[] }>("/api/execution-attempts?intent=review");
  const {
    data: phaseReviewHistoryData,
    loading: phaseReviewHistoryLoading,
    error: phaseReviewHistoryError,
    refetch: refetchPhaseReviewHistory,
  } = useFetch<{ runs: PhaseReviewAttempt[] }>("/api/project-phase-runs?intent=review");
  const teamAgents = useMemo(() => data?.team || [], [data]);
  const tasks = useMemo(() => tasksData?.tasks || [], [tasksData]);
  const projects = useMemo(() => projectsData?.projects || [], [projectsData]);
  const taskReviewAttempts = useMemo(
    () => taskReviewHistoryData?.attempts || [],
    [taskReviewHistoryData]
  );
  const phaseReviewAttempts = useMemo(
    () => phaseReviewHistoryData?.runs || [],
    [phaseReviewHistoryData]
  );
  const friendlyError = useMemo(() => describeTeamError(error), [error]);

  const [query, setQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [reviewFocus, setReviewFocus] = useState("");
  const [reviewActionPendingKey, setReviewActionPendingKey] = useState<string | null>(null);
  const [reviewActionErrorKey, setReviewActionErrorKey] = useState<string | null>(null);
  const [reviewActionError, setReviewActionError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      refetch();
      refetchTasks();
      refetchProjects();
      refetchTaskReviewHistory();
      refetchPhaseReviewHistory();
    }, 30_000);

    return () => clearInterval(timer);
  }, [refetch, refetchPhaseReviewHistory, refetchProjects, refetchTaskReviewHistory, refetchTasks]);

  const filteredAgents = useMemo(() => {
    const q = query.trim().toLowerCase();

    return teamAgents.filter((agent) => {
      if (tierFilter !== "all" && agent.tier !== tierFilter) return false;

      const activity = getActivityState(agent);
      if (activityFilter !== "all" && activity !== activityFilter) return false;

      if (!q) return true;

      const haystack = [
        agent.id,
        agent.name,
        agent.role,
        agent.description,
        agent.tags.map((tag) => tag.label).join(" "),
        agent.reportsTo || "",
        (agent.canReviewFor || []).join(" "),
        (agent.canDelegateTo || []).join(" "),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [teamAgents, query, tierFilter, activityFilter]);

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
  const selectedReviewAgent = useMemo(
    () =>
      effectiveReviewFocus === REVIEW_FOCUS_ALL || effectiveReviewFocus === REVIEW_FOCUS_UNASSIGNED
        ? null
        : teamAgents.find((agent) => agent.id === effectiveReviewFocus) || null,
    [effectiveReviewFocus, teamAgents]
  );
  const reviewQueueTitle = useMemo(
    () => describeReviewFocus(effectiveReviewFocus, selectedReviewAgent),
    [effectiveReviewFocus, selectedReviewAgent]
  );
  const taskReviewQueue = useMemo(
    () => tasks.filter((task) => task.runStatus === "needs_review"),
    [tasks]
  );
  const phaseReviewQueue = useMemo<ReviewPhaseItem[]>(
    () =>
      projects.flatMap((project) =>
        project.phases
          .filter((phase) => phase.latestRun?.runStatus === "needs_review")
          .map((phase) => ({
            projectId: project.id,
            projectTitle: project.title,
            phase,
          }))
      ),
    [projects]
  );
  const selectedTaskReviewQueue = useMemo(
    () =>
      taskReviewQueue
        .filter((task) => matchesReviewerFocus(task.reviewerAgentId, effectiveReviewFocus))
        .sort((left, right) => {
          const leftTime = left.latestRun?.timestamp ? new Date(left.latestRun.timestamp).getTime() : 0;
          const rightTime = right.latestRun?.timestamp ? new Date(right.latestRun.timestamp).getTime() : 0;
          return rightTime - leftTime;
        }),
    [effectiveReviewFocus, taskReviewQueue]
  );
  const selectedPhaseReviewQueue = useMemo(
    () =>
      phaseReviewQueue
        .filter((entry) => matchesReviewerFocus(entry.phase.reviewerAgentId, effectiveReviewFocus))
        .sort((left, right) => {
          const leftTime = left.phase.latestRun?.timestamp ? new Date(left.phase.latestRun.timestamp).getTime() : 0;
          const rightTime = right.phase.latestRun?.timestamp ? new Date(right.phase.latestRun.timestamp).getTime() : 0;
          return rightTime - leftTime;
        }),
    [effectiveReviewFocus, phaseReviewQueue]
  );
  const unassignedTaskReviewCount = useMemo(
    () => taskReviewQueue.filter((task) => !task.reviewerAgentId).length,
    [taskReviewQueue]
  );
  const unassignedPhaseReviewCount = useMemo(
    () => phaseReviewQueue.filter((entry) => !entry.phase.reviewerAgentId).length,
    [phaseReviewQueue]
  );
  const taskById = useMemo(
    () => new Map(tasks.map((task) => [task.id, task])),
    [tasks]
  );
  const phaseByKey = useMemo(() => {
    const entries = projects.flatMap((project) =>
      project.phases.map((phase) => [`${project.id}:${phase.id}`, { project, phase }] as const)
    );
    return new Map(entries);
  }, [projects]);
  const recentReviewDecisions = useMemo<ReviewDecisionItem[]>(
    () => {
      const latestTaskDecisionByTask = new Map<string, TaskReviewAttempt>();
      for (const attempt of taskReviewAttempts) {
        if (!attempt.fields?.decision || latestTaskDecisionByTask.has(attempt.taskId)) continue;
        latestTaskDecisionByTask.set(attempt.taskId, attempt);
      }

      const latestPhaseDecisionByPhase = new Map<string, PhaseReviewAttempt>();
      for (const attempt of phaseReviewAttempts) {
        const key = `${attempt.projectId}:${attempt.phaseId}`;
        if (!attempt.fields?.decision || latestPhaseDecisionByPhase.has(key)) continue;
        latestPhaseDecisionByPhase.set(key, attempt);
      }

      const taskItems = Array.from(latestTaskDecisionByTask.values()).flatMap<ReviewDecisionItem>((attempt) => {
        const task = taskById.get(attempt.taskId);
        if (!matchesReviewerFocus(task?.reviewerAgentId, effectiveReviewFocus)) {
          return [];
        }

        return [{
          key: `task:${attempt.taskId}`,
          kind: "task",
          title: task?.title || attempt.taskTitle || attempt.taskId,
          context: task?.project || "No project",
          href: `/agents/tasks?task=${encodeURIComponent(attempt.taskId)}`,
          timestamp: attempt.timestamp,
          decision: attempt.fields?.decision || "UNKNOWN",
          handoffTo: attempt.fields?.handoffTo,
          note: attempt.fields?.needsFromHuman,
        }];
      });

      const phaseItems = Array.from(latestPhaseDecisionByPhase.values()).flatMap<ReviewDecisionItem>((attempt) => {
        const resolvedPhase = phaseByKey.get(`${attempt.projectId}:${attempt.phaseId}`);
        if (!matchesReviewerFocus(resolvedPhase?.phase.reviewerAgentId, effectiveReviewFocus)) {
          return [];
        }

        return [{
          key: `phase:${attempt.projectId}:${attempt.phaseId}`,
          kind: "phase",
          title: resolvedPhase?.phase.title || attempt.phaseTitle || attempt.phaseId,
          context: resolvedPhase?.project.title || attempt.projectTitle || attempt.projectId,
          href: `/agents/projects?review=1&project=${encodeURIComponent(resolvedPhase?.project.title || attempt.projectTitle || attempt.projectId)}&projectId=${encodeURIComponent(attempt.projectId)}&phaseId=${encodeURIComponent(attempt.phaseId)}`,
          timestamp: attempt.timestamp,
          decision: attempt.fields?.decision || "UNKNOWN",
          handoffTo: attempt.fields?.handoffTo,
          note: attempt.fields?.needsFromHuman,
        }];
      });

      return [...taskItems, ...phaseItems]
        .sort((left, right) => {
          const leftTime = left.timestamp ? new Date(left.timestamp).getTime() : 0;
          const rightTime = right.timestamp ? new Date(right.timestamp).getTime() : 0;
          return rightTime - leftTime;
        })
        .slice(0, 6);
    },
    [effectiveReviewFocus, phaseByKey, phaseReviewAttempts, taskById, taskReviewAttempts]
  );
  const reviewInboxError = [tasksError, projectsError, taskReviewHistoryError, phaseReviewHistoryError]
    .filter(Boolean)
    .join(" ");
  const reviewInboxLoading = (!tasksData && tasksLoading) || (!projectsData && projectsLoading);
  const reviewDecisionsLoading =
    (!taskReviewHistoryData && taskReviewHistoryLoading) ||
    (!phaseReviewHistoryData && phaseReviewHistoryLoading);

  const getPendingDecision = (itemKey: string): ReviewDecision | null => {
    if (!reviewActionPendingKey?.startsWith(`${itemKey}:`)) {
      return null;
    }

    const decision = reviewActionPendingKey.slice(itemKey.length + 1);
    return decision === "approve" || decision === "rework" || decision === "block"
      ? decision
      : null;
  };

  const getReviewActionError = (itemKey: string) =>
    reviewActionErrorKey === itemKey ? reviewActionError : null;

  const handleInboxTaskDecision = async (
    task: Task,
    payload: ReviewDecisionSubmitPayload
  ) => {
    const itemKey = `task:${task.id}`;
    const pendingKey = `${itemKey}:${payload.decision}`;
    setReviewActionPendingKey(pendingKey);
    setReviewActionErrorKey(null);
    setReviewActionError(null);

    try {
      const response = await fetch("/api/execution-attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: task.id,
          intent: "review",
          decision: payload.decision,
          note: payload.note,
          handoffTo: payload.handoffTo || undefined,
        }),
      });

      const responsePayload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error(responsePayload?.error || "Failed to record task review decision");
      }

      await Promise.all([
        refetchTasks(),
        refetchProjects(),
        refetchTaskReviewHistory(),
        refetchPhaseReviewHistory(),
      ]);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to record task review decision";
      setReviewActionErrorKey(itemKey);
      setReviewActionError(message);
      throw err instanceof Error ? err : new Error(message);
    } finally {
      setReviewActionPendingKey(null);
    }
  };

  const handleInboxPhaseDecision = async (
    entry: ReviewPhaseItem,
    payload: ReviewDecisionSubmitPayload
  ) => {
    const itemKey = `phase:${entry.projectId}:${entry.phase.id}`;
    const pendingKey = `${itemKey}:${payload.decision}`;
    setReviewActionPendingKey(pendingKey);
    setReviewActionErrorKey(null);
    setReviewActionError(null);

    try {
      const response = await fetch("/api/project-phase-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: entry.projectId,
          phaseId: entry.phase.id,
          decision: payload.decision,
          note: payload.note,
          handoffTo: payload.handoffTo || undefined,
        }),
      });

      const responsePayload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error(responsePayload?.error || "Failed to record phase review decision");
      }

      await Promise.all([
        refetchTasks(),
        refetchProjects(),
        refetchTaskReviewHistory(),
        refetchPhaseReviewHistory(),
      ]);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to record phase review decision";
      setReviewActionErrorKey(itemKey);
      setReviewActionError(message);
      throw err instanceof Error ? err : new Error(message);
    } finally {
      setReviewActionPendingKey(null);
    }
  };

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
          &ldquo;Configured agent roster with roles, relationships, and recent presence at a glance.&rdquo;
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
          organized, including reporting lines, review coverage, and delegation paths. Presence labels here mean <strong>active now</strong>, <strong>recently seen</strong>, or
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

      <div
        className="rounded-xl p-4 md:p-5 mb-8"
        style={{
          backgroundColor: "var(--surface-elevated)",
          border: "1px solid var(--border)",
          backgroundImage: "linear-gradient(135deg, rgba(255, 159, 10, 0.08), rgba(10, 132, 255, 0.04))",
        }}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "#FF9F0A" }}>
                Unified Review Inbox
              </p>
              <h2 className="text-xl font-semibold mt-1" style={{ color: "var(--text-primary)" }}>
                {reviewQueueTitle}
              </h2>
            </div>
            <p className="text-sm max-w-2xl" style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
              One place to inspect task and phase work that still needs review. Use this as Henry&apos;s cross-surface inbox, then jump into Tasks or Projects only when you need the full editor or the selected phase/task context.
            </p>
          </div>

          <label className="flex flex-col gap-1.5 text-xs font-semibold w-full lg:max-w-xs" style={{ color: "var(--text-secondary)" }}>
            Reviewer focus
            <select
              value={effectiveReviewFocus}
              onChange={(event) => setReviewFocus(event.target.value)}
              style={controlStyle}
              aria-label="Review inbox focus"
            >
              <option value={REVIEW_FOCUS_ALL}>All review items</option>
              <option value={REVIEW_FOCUS_UNASSIGNED}>Unassigned only</option>
              {teamAgents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span
            className="rounded-full px-3 py-1 font-semibold"
            style={{
              color: "#FF9F0A",
              backgroundColor: "color-mix(in srgb, #FF9F0A 14%, transparent)",
              border: "1px solid color-mix(in srgb, #FF9F0A 28%, transparent)",
            }}
          >
            {selectedTaskReviewQueue.length} task{selectedTaskReviewQueue.length === 1 ? "" : "s"} in queue
          </span>
          <span
            className="rounded-full px-3 py-1 font-semibold"
            style={{
              color: "#0A84FF",
              backgroundColor: "color-mix(in srgb, #0A84FF 14%, transparent)",
              border: "1px solid color-mix(in srgb, #0A84FF 28%, transparent)",
            }}
          >
            {selectedPhaseReviewQueue.length} phase{selectedPhaseReviewQueue.length === 1 ? "" : "s"} in queue
          </span>
          {(unassignedTaskReviewCount > 0 || unassignedPhaseReviewCount > 0) && (
            <button
              type="button"
              onClick={() => setReviewFocus(REVIEW_FOCUS_UNASSIGNED)}
              className="rounded-full px-3 py-1 font-semibold transition-colors"
              style={{
                color: "#FFD60A",
                backgroundColor: "color-mix(in srgb, #FFD60A 16%, transparent)",
                border: "1px solid color-mix(in srgb, #FFD60A 30%, transparent)",
                opacity: effectiveReviewFocus === REVIEW_FOCUS_UNASSIGNED ? 1 : 0.9,
              }}
            >
              {unassignedTaskReviewCount + unassignedPhaseReviewCount} unassigned review item{unassignedTaskReviewCount + unassignedPhaseReviewCount === 1 ? "" : "s"}
            </button>
          )}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div
            className="rounded-xl p-4"
            style={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  Task reviews
                </p>
                <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>
                  Owner packets and manual review decisions that still need reviewer action.
                </p>
              </div>
              <Link
                href="/agents/tasks?review=1"
                className="text-[11px] font-semibold"
                style={{ color: "#FF9F0A" }}
              >
                Open Tasks queue -&gt;
              </Link>
            </div>

            <div className="mt-3 space-y-2">
              {reviewInboxLoading && selectedTaskReviewQueue.length === 0 ? (
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  Loading review inbox...
                </p>
              ) : selectedTaskReviewQueue.length === 0 ? (
                <p className="text-[11px]" style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>
                  {effectiveReviewFocus === REVIEW_FOCUS_ALL
                    ? "No task reviews are waiting right now."
                    : effectiveReviewFocus === REVIEW_FOCUS_UNASSIGNED
                      ? "No unassigned task reviews are waiting right now."
                      : `No task reviews are explicitly assigned to ${selectedReviewAgent?.name || "this reviewer"}.`}
                </p>
              ) : (
                selectedTaskReviewQueue.slice(0, 4).map((task) => (
                  <div
                    key={task.id}
                    className="rounded-lg p-3"
                    style={{
                      backgroundColor: "var(--surface-hover)",
                      border: "1px solid color-mix(in srgb, var(--border) 30%, transparent)",
                    }}
                  >
                    <Link
                      href={`/agents/tasks?review=1&task=${encodeURIComponent(task.id)}`}
                      className="block transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                            {task.title}
                          </p>
                          <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                            {task.project || "No project"} - {formatReviewTimestamp(task.latestRun?.timestamp)}
                          </p>
                          <p className="mt-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
                            Reviewer: {task.reviewerAgentId ? selectedReviewAgent && task.reviewerAgentId === selectedReviewAgent.id ? selectedReviewAgent.name : teamAgents.find((agent) => agent.id === task.reviewerAgentId)?.name || task.reviewerAgentId : "Unassigned"}
                          </p>
                        </div>
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                          style={{
                            color: "#FF9F0A",
                            backgroundColor: "color-mix(in srgb, #FF9F0A 14%, transparent)",
                            border: "1px solid color-mix(in srgb, #FF9F0A 28%, transparent)",
                          }}
                        >
                          {task.latestRun?.fields?.decision || "Needs review"}
                        </span>
                      </div>
                    </Link>
                    <div className="mt-3">
                      <ReviewDecisionComposer
                        agentOptions={teamAgents}
                        defaultHandoffToAgentId={task.handoffToAgentId || ""}
                        pendingDecision={getPendingDecision(`task:${task.id}`)}
                        error={getReviewActionError(`task:${task.id}`)}
                        onSubmit={(payload) => handleInboxTaskDecision(task, payload)}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div
            className="rounded-xl p-4"
            style={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  Project phase reviews
                </p>
                <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>
                  Phase coordination packets and review decisions that still need follow-through.
                </p>
              </div>
              <Link
                href="/agents/projects?review=1"
                className="text-[11px] font-semibold"
                style={{ color: "#0A84FF" }}
              >
                Open Projects queue -&gt;
              </Link>
            </div>

            <div className="mt-3 space-y-2">
              {reviewInboxLoading && selectedPhaseReviewQueue.length === 0 ? (
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  Loading review inbox...
                </p>
              ) : selectedPhaseReviewQueue.length === 0 ? (
                <p className="text-[11px]" style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>
                  {effectiveReviewFocus === REVIEW_FOCUS_ALL
                    ? "No phase reviews are waiting right now."
                    : effectiveReviewFocus === REVIEW_FOCUS_UNASSIGNED
                      ? "No unassigned phase reviews are waiting right now."
                      : `No phase reviews are explicitly assigned to ${selectedReviewAgent?.name || "this reviewer"}.`}
                </p>
              ) : (
                selectedPhaseReviewQueue.slice(0, 4).map((entry) => (
                  <div
                    key={`${entry.projectId}:${entry.phase.id}`}
                    className="rounded-lg p-3"
                    style={{
                      backgroundColor: "var(--surface-hover)",
                      border: "1px solid color-mix(in srgb, var(--border) 30%, transparent)",
                    }}
                  >
                    <Link
                      href={`/agents/projects?review=1&project=${encodeURIComponent(entry.projectTitle)}&projectId=${encodeURIComponent(entry.projectId)}&phaseId=${encodeURIComponent(entry.phase.id)}`}
                      className="block transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                            {entry.phase.title}
                          </p>
                          <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                            {entry.projectTitle} - {formatReviewTimestamp(entry.phase.latestRun?.timestamp)}
                          </p>
                          <p className="mt-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
                            Reviewer: {entry.phase.reviewerAgentId ? teamAgents.find((agent) => agent.id === entry.phase.reviewerAgentId)?.name || entry.phase.reviewerAgentId : "Unassigned"}
                          </p>
                        </div>
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                          style={{
                            color: "#0A84FF",
                            backgroundColor: "color-mix(in srgb, #0A84FF 14%, transparent)",
                            border: "1px solid color-mix(in srgb, #0A84FF 28%, transparent)",
                          }}
                        >
                          {entry.phase.latestRun?.fields?.decision || "Needs review"}
                        </span>
                      </div>
                    </Link>
                    <div className="mt-3">
                      <ReviewDecisionComposer
                        agentOptions={teamAgents}
                        defaultHandoffToAgentId={entry.phase.handoffToAgentId || ""}
                        pendingDecision={getPendingDecision(`phase:${entry.projectId}:${entry.phase.id}`)}
                        error={getReviewActionError(`phase:${entry.projectId}:${entry.phase.id}`)}
                        onSubmit={(payload) => handleInboxPhaseDecision(entry, payload)}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div
          className="mt-4 rounded-xl p-4"
          style={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Recent review decisions
              </p>
              <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>
                Keeps the latest approve / rework / blocked decisions visible after an item leaves the active queue.
              </p>
            </div>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {reviewDecisionsLoading && recentReviewDecisions.length === 0 ? (
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                Loading recent review decisions...
              </p>
            ) : recentReviewDecisions.length === 0 ? (
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                No review decisions recorded yet.
              </p>
            ) : (
              recentReviewDecisions.map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  className="block rounded-lg p-3 transition-colors"
                  style={{
                    backgroundColor: "var(--surface-hover)",
                    border: "1px solid color-mix(in srgb, var(--border) 30%, transparent)",
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                        {item.title}
                      </p>
                      <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                        {item.kind === "task" ? "Task" : "Phase"} - {item.context}
                      </p>
                      <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                        {formatReviewTimestamp(item.timestamp)}
                      </p>
                    </div>
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                      style={decisionTone(item.decision)}
                    >
                      {item.decision}
                    </span>
                  </div>
                  {item.handoffTo && (
                    <p className="mt-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
                      Handoff: {item.handoffTo}
                    </p>
                  )}
                  {item.note && (
                    <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>
                      Note: {item.note}
                    </p>
                  )}
                </Link>
              ))
            )}
          </div>
        </div>

        {reviewInboxError && (
          <p className="mt-3 text-xs" style={{ color: "var(--status-blocked)" }}>
            Review inbox sync delayed: {reviewInboxError}
          </p>
        )}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, role, skill, relationship..."
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
                <AgentCard key={agent.id} agent={agent} allAgents={teamAgents} onUpdate={refetch} />
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
