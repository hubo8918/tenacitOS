export type WorkItemKind = "task" | "phase";
export type WorkItemRunStatus =
  | "idle"
  | "queued"
  | "running"
  | "needs_review"
  | "done"
  | "failed";
export type WorkItemStatus = "pending" | "in_progress" | "blocked" | "completed";
export type WorkItemIntent =
  | "start"
  | "review"
  | "debug"
  | "agent_check_in"
  | "agent_wake";
export type WorkItemRunKind = "manual" | "agent_packet";
export type ReviewDecisionValue = "approve" | "rework" | "block";

export interface WorkItemRunFields {
  status?: string;
  focus?: string;
  next?: string;
  blockers?: string;
  needsFromHuman?: string;
  decision?: string;
  handoffTo?: string;
  reviewerAgentId?: string;
  reviewerName?: string;
  managerAction?: string;
  mutationSummary?: string;
  createdTasks?: string;
  updatedTasks?: string;
  phaseUpdate?: string;
  projectProgress?: string;
}

export interface WorkItemDeepLink {
  href: string;
  label: string;
}

export interface WorkItemLatestRun {
  id: string;
  kind: WorkItemRunKind;
  intent: WorkItemIntent;
  action?: "check-in" | "wake" | "review";
  timestamp: string;
  runStatus?: WorkItemRunStatus;
  executionMode?: "manual" | "agent-run";
  deliverable?: string;
  text?: string;
  agentId?: string;
  agentName?: string;
  model?: string;
  sessionId?: string;
  runId?: string;
  thinking?: string;
  fields?: WorkItemRunFields | null;
}

export interface WorkItemReviewAttempt {
  id: string;
  kind: WorkItemKind;
  itemId: string;
  title: string;
  parentId?: string;
  parentTitle?: string;
  reviewerAgentId?: string;
  reviewerName?: string;
  timestamp: string;
  decision?: string;
  handoffTo?: string;
  note?: string;
  deepLink: WorkItemDeepLink;
}

export interface WorkItemInboxCounts {
  total: number;
  task: number;
  phase: number;
  unassigned: number;
}

export interface WorkItemSummary {
  kind: WorkItemKind;
  id: string;
  title: string;
  parentId?: string;
  parentTitle?: string;
  status: WorkItemStatus;
  runStatus: WorkItemRunStatus;
  ownerAgentId?: string;
  reviewerAgentId?: string;
  handoffToAgentId?: string;
  latestRun?: WorkItemLatestRun | null;
  latestReviewDecision?: WorkItemReviewAttempt | null;
  deepLink: WorkItemDeepLink;
}

export interface WorkItemDashboardData {
  items: WorkItemSummary[];
  counts: WorkItemInboxCounts;
  decisions: WorkItemReviewAttempt[];
}

export interface WorkItemHistoryEntry extends WorkItemLatestRun {
  itemKind: WorkItemKind;
  itemId: string;
  title: string;
  parentId?: string;
  parentTitle?: string;
  deepLink: WorkItemDeepLink;
}
