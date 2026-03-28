import type { ProjectPhaseLatestRun } from "@/data/mockProjectsData";
import type { TaskLatestRun } from "@/lib/agent-tasks-data";
import { getAgentTasks } from "@/lib/agent-tasks-data";
import { getProjects } from "@/lib/projects-data";
import { getProjectPhaseRuns } from "@/lib/project-phase-runs-data";
import { getExecutionAttempts } from "@/lib/task-runs-data";
import type {
  WorkItemDashboardData,
  WorkItemDeepLink,
  WorkItemHistoryEntry,
  WorkItemInboxCounts,
  WorkItemKind,
  WorkItemLatestRun,
  WorkItemReviewAttempt,
  WorkItemRunFields,
  WorkItemRunStatus,
  WorkItemStatus,
  WorkItemSummary,
} from "@/lib/work-item-types";

const REVIEWER_FILTER_ALL = "__all__";
const REVIEWER_FILTER_UNASSIGNED = "__unassigned__";

type TaskRecord = Awaited<ReturnType<typeof getAgentTasks>>[number];
type ProjectRecord = Awaited<ReturnType<typeof getProjects>>[number];
type TaskReviewAttemptRecord = Awaited<ReturnType<typeof getExecutionAttempts>>[number];
type PhaseReviewAttemptRecord = Awaited<ReturnType<typeof getProjectPhaseRuns>>[number];

interface WorkItemCollections {
  tasks: TaskRecord[];
  projects: ProjectRecord[];
  taskReviewAttempts: TaskReviewAttemptRecord[];
  phaseReviewAttempts: PhaseReviewAttemptRecord[];
}

function toTaskDeepLink(taskId: string): WorkItemDeepLink {
  return {
    href: `/agents/tasks?taskId=${encodeURIComponent(taskId)}`,
    label: "Open task",
  };
}

function toPhaseDeepLink(projectId: string, phaseId: string): WorkItemDeepLink {
  return {
    href: `/agents/projects?projectId=${encodeURIComponent(projectId)}&phaseId=${encodeURIComponent(phaseId)}`,
    label: "Open phase",
  };
}

function normalizeWorkItemStatus(value: unknown): WorkItemStatus {
  return value === "in_progress" || value === "blocked" || value === "completed"
    ? value
    : "pending";
}

function normalizeRunFields(value: unknown): WorkItemRunFields | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const fields = value as Record<string, unknown>;
  const nextFields: WorkItemRunFields = {};

  if (typeof fields.status === "string" && fields.status.trim()) nextFields.status = fields.status.trim();
  if (typeof fields.focus === "string" && fields.focus.trim()) nextFields.focus = fields.focus.trim();
  if (typeof fields.next === "string" && fields.next.trim()) nextFields.next = fields.next.trim();
  if (typeof fields.blockers === "string" && fields.blockers.trim()) nextFields.blockers = fields.blockers.trim();
  if (typeof fields.needsFromHuman === "string" && fields.needsFromHuman.trim()) {
    nextFields.needsFromHuman = fields.needsFromHuman.trim();
  }
  if (typeof fields.decision === "string" && fields.decision.trim()) nextFields.decision = fields.decision.trim();
  if (typeof fields.handoffTo === "string" && fields.handoffTo.trim()) nextFields.handoffTo = fields.handoffTo.trim();
  if (typeof fields.reviewerAgentId === "string" && fields.reviewerAgentId.trim()) {
    nextFields.reviewerAgentId = fields.reviewerAgentId.trim();
  }
  if (typeof fields.reviewerName === "string" && fields.reviewerName.trim()) {
    nextFields.reviewerName = fields.reviewerName.trim();
  }
  if (typeof fields.managerAction === "string" && fields.managerAction.trim()) {
    nextFields.managerAction = fields.managerAction.trim();
  }
  if (typeof fields.mutationSummary === "string" && fields.mutationSummary.trim()) {
    nextFields.mutationSummary = fields.mutationSummary.trim();
  }
  if (typeof fields.createdTasks === "string" && fields.createdTasks.trim()) {
    nextFields.createdTasks = fields.createdTasks.trim();
  }
  if (typeof fields.updatedTasks === "string" && fields.updatedTasks.trim()) {
    nextFields.updatedTasks = fields.updatedTasks.trim();
  }
  if (typeof fields.phaseUpdate === "string" && fields.phaseUpdate.trim()) {
    nextFields.phaseUpdate = fields.phaseUpdate.trim();
  }
  if (typeof fields.projectProgress === "string" && fields.projectProgress.trim()) {
    nextFields.projectProgress = fields.projectProgress.trim();
  }

  return Object.keys(nextFields).length > 0 ? nextFields : null;
}

function toLatestRun(run: TaskLatestRun | ProjectPhaseLatestRun | null | undefined): WorkItemLatestRun | null {
  if (!run) return null;

  return {
    id: run.id,
    kind: run.kind,
    intent: run.intent,
    action: run.action,
    timestamp: run.timestamp,
    runStatus: run.runStatus,
    executionMode: run.executionMode,
    deliverable: run.deliverable,
    text: run.text,
    agentId: run.agentId,
    agentName: run.agentName,
    model: run.model,
    sessionId: run.sessionId,
    runId: run.runId,
    thinking: run.thinking,
    fields: normalizeRunFields(run.fields),
  };
}

function matchesReviewerFilter(reviewerAgentId: string | undefined, reviewerFilter?: string): boolean {
  if (!reviewerFilter || reviewerFilter === REVIEWER_FILTER_ALL) return true;
  if (reviewerFilter === REVIEWER_FILTER_UNASSIGNED) return !reviewerAgentId;
  return reviewerAgentId === reviewerFilter;
}

function asReviewAttempt(
  kind: WorkItemKind,
  itemId: string,
  title: string,
  parentId: string | undefined,
  parentTitle: string | undefined,
  reviewerAgentId: string | undefined,
  deepLink: WorkItemDeepLink,
  attempt: {
    id: string;
    timestamp: string;
    fields?: {
      decision?: string;
      handoffTo?: string;
      needsFromHuman?: string;
      reviewerAgentId?: string;
      reviewerName?: string;
    } | null;
  } | null
): WorkItemReviewAttempt | null {
  if (!attempt?.fields?.decision) return null;

  return {
    id: attempt.id,
    kind,
    itemId,
    title,
    parentId,
    parentTitle,
    reviewerAgentId: attempt.fields.reviewerAgentId || reviewerAgentId,
    reviewerName: attempt.fields.reviewerName,
    timestamp: attempt.timestamp,
    decision: attempt.fields.decision,
    handoffTo: attempt.fields.handoffTo,
    note: attempt.fields.needsFromHuman,
    deepLink,
  };
}

function sortByLatestTimestamp<T extends { latestRun?: { timestamp?: string } | null }>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    const leftTime = left.latestRun?.timestamp ? new Date(left.latestRun.timestamp).getTime() : 0;
    const rightTime = right.latestRun?.timestamp ? new Date(right.latestRun.timestamp).getTime() : 0;
    return rightTime - leftTime;
  });
}

function countInboxItems(items: WorkItemSummary[]): WorkItemInboxCounts {
  return {
    total: items.length,
    task: items.filter((item) => item.kind === "task").length,
    phase: items.filter((item) => item.kind === "phase").length,
    unassigned: items.filter((item) => !item.reviewerAgentId).length,
  };
}

async function loadWorkItemCollections(): Promise<WorkItemCollections> {
  const [tasks, projects, taskReviewAttempts, phaseReviewAttempts] = await Promise.all([
    getAgentTasks(),
    getProjects(),
    getExecutionAttempts({ intent: "review" }),
    getProjectPhaseRuns({ intent: "review" }),
  ]);

  return {
    tasks,
    projects,
    taskReviewAttempts,
    phaseReviewAttempts,
  };
}

function buildLatestTaskReviewDecisionMap(taskReviewAttempts: TaskReviewAttemptRecord[]) {
  const latestTaskReviewById = new Map<string, ReturnType<typeof asReviewAttempt>>();

  taskReviewAttempts.forEach((attempt) => {
    if (latestTaskReviewById.has(attempt.taskId)) return;
    latestTaskReviewById.set(
      attempt.taskId,
      asReviewAttempt(
        "task",
        attempt.taskId,
        attempt.taskTitle || attempt.taskId,
        undefined,
        undefined,
        attempt.fields?.reviewerAgentId,
        toTaskDeepLink(attempt.taskId),
        attempt
      )
    );
  });

  return latestTaskReviewById;
}

function buildLatestPhaseReviewDecisionMap(phaseReviewAttempts: PhaseReviewAttemptRecord[]) {
  const latestPhaseReviewByKey = new Map<string, ReturnType<typeof asReviewAttempt>>();

  phaseReviewAttempts.forEach((attempt) => {
    const key = `${attempt.projectId}:${attempt.phaseId}`;
    if (latestPhaseReviewByKey.has(key)) return;
    latestPhaseReviewByKey.set(
      key,
      asReviewAttempt(
        "phase",
        attempt.phaseId,
        attempt.phaseTitle || attempt.phaseId,
        attempt.projectId,
        attempt.projectTitle,
        attempt.fields?.reviewerAgentId,
        toPhaseDeepLink(attempt.projectId, attempt.phaseId),
        attempt
      )
    );
  });

  return latestPhaseReviewByKey;
}

function buildWorkItemInboxFromCollections(
  collections: WorkItemCollections,
  options?: {
    reviewer?: string;
    status?: WorkItemRunStatus;
  }
): WorkItemSummary[] {
  const reviewer = options?.reviewer;
  const requiredStatus = options?.status || "needs_review";
  const latestTaskReviewById = buildLatestTaskReviewDecisionMap(collections.taskReviewAttempts);
  const latestPhaseReviewByKey = buildLatestPhaseReviewDecisionMap(collections.phaseReviewAttempts);

  const taskItems = collections.tasks
    .filter((task) => (task.runStatus || "idle") === requiredStatus)
    .filter((task) => matchesReviewerFilter(task.reviewerAgentId, reviewer))
    .map<WorkItemSummary>((task) => ({
      kind: "task",
      id: task.id,
      title: task.title,
      parentId: task.projectId,
      parentTitle: task.project || undefined,
      status: normalizeWorkItemStatus(task.status),
      runStatus: task.runStatus || "idle",
      ownerAgentId: task.assigneeAgentId || task.agent.id,
      reviewerAgentId: task.reviewerAgentId,
      handoffToAgentId: task.handoffToAgentId,
      latestRun: toLatestRun(task.latestRun),
      latestReviewDecision: latestTaskReviewById.get(task.id) || null,
      deepLink: toTaskDeepLink(task.id),
    }));

  const phaseItems = collections.projects.flatMap((project) =>
    project.phases
      .filter((phase) => (phase.latestRun?.runStatus || "idle") === requiredStatus)
      .filter((phase) => matchesReviewerFilter(phase.reviewerAgentId, reviewer))
      .map<WorkItemSummary>((phase) => ({
        kind: "phase",
        id: phase.id,
        title: phase.title,
        parentId: project.id,
        parentTitle: project.title,
        status: normalizeWorkItemStatus(phase.status),
        runStatus: phase.latestRun?.runStatus || "idle",
        ownerAgentId: phase.ownerAgentId,
        reviewerAgentId: phase.reviewerAgentId,
        handoffToAgentId: phase.handoffToAgentId,
        latestRun: toLatestRun(phase.latestRun),
        latestReviewDecision: latestPhaseReviewByKey.get(`${project.id}:${phase.id}`) || null,
        deepLink: toPhaseDeepLink(project.id, phase.id),
      }))
  );

  return sortByLatestTimestamp([...taskItems, ...phaseItems]);
}

function buildRecentReviewDecisionsFromCollections(
  collections: WorkItemCollections,
  options?: {
    reviewer?: string;
    limit?: number;
  }
): WorkItemReviewAttempt[] {
  const reviewer = options?.reviewer;
  const limit = options?.limit || 8;
  const taskById = new Map(collections.tasks.map((task) => [task.id, task]));
  const phaseByKey = new Map<string, { project: ProjectRecord; phase: ProjectRecord["phases"][number] }>(
    collections.projects.flatMap((project) =>
      project.phases.map((phase) => [`${project.id}:${phase.id}`, { project, phase }] as const)
    )
  );

  const latestTaskDecisionByTask = new Map<string, WorkItemReviewAttempt>();
  collections.taskReviewAttempts.forEach((attempt) => {
    if (latestTaskDecisionByTask.has(attempt.taskId)) return;
    const task = taskById.get(attempt.taskId);
    if (!task) return;
    if (!matchesReviewerFilter(task.reviewerAgentId, reviewer)) return;

    const reviewAttempt = asReviewAttempt(
      "task",
      task.id,
      task.title,
      task.projectId,
      task.project || undefined,
      task.reviewerAgentId,
      toTaskDeepLink(task.id),
      attempt
    );
    if (reviewAttempt) {
      latestTaskDecisionByTask.set(task.id, reviewAttempt);
    }
  });

  const latestPhaseDecisionByPhase = new Map<string, WorkItemReviewAttempt>();
  collections.phaseReviewAttempts.forEach((attempt) => {
    const key = `${attempt.projectId}:${attempt.phaseId}`;
    if (latestPhaseDecisionByPhase.has(key)) return;
    const entity = phaseByKey.get(key);
    if (!entity) return;
    if (!matchesReviewerFilter(entity.phase.reviewerAgentId, reviewer)) return;

    const reviewAttempt = asReviewAttempt(
      "phase",
      entity.phase.id,
      entity.phase.title,
      entity.project.id,
      entity.project.title,
      entity.phase.reviewerAgentId,
      toPhaseDeepLink(entity.project.id, entity.phase.id),
      attempt
    );
    if (reviewAttempt) {
      latestPhaseDecisionByPhase.set(key, reviewAttempt);
    }
  });

  return [...latestTaskDecisionByTask.values(), ...latestPhaseDecisionByPhase.values()]
    .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
    .slice(0, limit);
}

export async function getWorkItemDashboardData(options?: {
  reviewer?: string;
  status?: WorkItemRunStatus;
  decisionsLimit?: number;
}): Promise<WorkItemDashboardData> {
  const collections = await loadWorkItemCollections();
  const items = buildWorkItemInboxFromCollections(collections, {
    reviewer: options?.reviewer,
    status: options?.status,
  });

  return {
    items,
    counts: countInboxItems(items),
    decisions: buildRecentReviewDecisionsFromCollections(collections, {
      reviewer: options?.reviewer,
      limit: options?.decisionsLimit,
    }),
  };
}

export async function getWorkItemInbox(options?: {
  reviewer?: string;
  status?: WorkItemRunStatus;
}): Promise<WorkItemSummary[]> {
  const collections = await loadWorkItemCollections();
  return buildWorkItemInboxFromCollections(collections, options);
}

export async function getRecentWorkItemReviewDecisions(options?: {
  reviewer?: string;
  limit?: number;
}): Promise<WorkItemReviewAttempt[]> {
  const collections = await loadWorkItemCollections();
  return buildRecentReviewDecisionsFromCollections(collections, options);
}

function toHistoryEntry(
  kind: WorkItemKind,
  itemId: string,
  title: string,
  parentId: string | undefined,
  parentTitle: string | undefined,
  deepLink: WorkItemDeepLink,
  attempt: TaskLatestRun | ProjectPhaseLatestRun
): WorkItemHistoryEntry {
  return {
    itemKind: kind,
    itemId,
    title,
    parentId,
    parentTitle,
    deepLink,
    ...toLatestRun(attempt)!,
  };
}

export async function getWorkItemEntity(options: {
  kind: WorkItemKind;
  itemId: string;
  projectId?: string;
}): Promise<{ item: WorkItemSummary | null; history: WorkItemHistoryEntry[] }> {
  if (options.kind === "task") {
    const [tasks, attempts] = await Promise.all([
      getAgentTasks(),
      getExecutionAttempts({ taskId: options.itemId }),
    ]);
    const task = tasks.find((entry) => entry.id === options.itemId) || null;
    if (!task) {
      return { item: null, history: [] };
    }

    const latestReviewAttempt = attempts.find((attempt) => attempt.intent === "review" && attempt.fields?.decision);
    const item: WorkItemSummary = {
      kind: "task",
      id: task.id,
      title: task.title,
      parentId: task.projectId,
      parentTitle: task.project || undefined,
      status: normalizeWorkItemStatus(task.status),
      runStatus: task.runStatus || "idle",
      ownerAgentId: task.assigneeAgentId || task.agent.id,
      reviewerAgentId: task.reviewerAgentId,
      handoffToAgentId: task.handoffToAgentId,
      latestRun: toLatestRun(task.latestRun),
      latestReviewDecision: asReviewAttempt(
        "task",
        task.id,
        task.title,
        task.projectId,
        task.project || undefined,
        task.reviewerAgentId,
        toTaskDeepLink(task.id),
        latestReviewAttempt || null
      ),
      deepLink: toTaskDeepLink(task.id),
    };

    const history = attempts.map((attempt) =>
      toHistoryEntry("task", task.id, task.title, task.projectId, task.project || undefined, toTaskDeepLink(task.id), attempt)
    );
    return { item, history };
  }

  const [projects, attempts] = await Promise.all([
    getProjects(),
    getProjectPhaseRuns({ projectId: options.projectId, phaseId: options.itemId }),
  ]);
  const project = projects.find((entry) => entry.id === options.projectId) || null;
  const phase = project?.phases.find((entry) => entry.id === options.itemId) || null;

  if (!project || !phase) {
    return { item: null, history: [] };
  }

  const latestReviewAttempt = attempts.find((attempt) => attempt.intent === "review" && attempt.fields?.decision);
  const item: WorkItemSummary = {
    kind: "phase",
    id: phase.id,
    title: phase.title,
    parentId: project.id,
    parentTitle: project.title,
    status: normalizeWorkItemStatus(phase.status),
    runStatus: phase.latestRun?.runStatus || "idle",
    ownerAgentId: phase.ownerAgentId,
    reviewerAgentId: phase.reviewerAgentId,
    handoffToAgentId: phase.handoffToAgentId,
    latestRun: toLatestRun(phase.latestRun),
    latestReviewDecision: asReviewAttempt(
      "phase",
      phase.id,
      phase.title,
      project.id,
      project.title,
      phase.reviewerAgentId,
      toPhaseDeepLink(project.id, phase.id),
      latestReviewAttempt || null
    ),
    deepLink: toPhaseDeepLink(project.id, phase.id),
  };

  const history = attempts.map((attempt) =>
    toHistoryEntry("phase", phase.id, phase.title, project.id, project.title, toPhaseDeepLink(project.id, phase.id), attempt)
  );
  return { item, history };
}
