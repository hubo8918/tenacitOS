import { NextRequest, NextResponse } from "next/server";
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";

import { getAgentTasks, normalizeAgentTask, saveAgentTasks, type AgentTask, type TaskRunIntent } from "@/lib/agent-tasks-data";
import { getAgentsSummary, type AgentSummary } from "@/lib/agents-data";
import { validateRoutingPolicy } from "@/lib/agent-routing-policy";
import { type Task } from "@/data/mockTasksData";
import { recordProjectPhaseRun } from "@/lib/project-phase-runs-data";
import { applyDerivedProjectProgress } from "@/lib/project-progress";
import { getProjects, saveProjects } from "@/lib/projects-data";
import { taskLinksToProject } from "@/lib/project-task-linkage";
import { recordTaskRun } from "@/lib/task-runs-data";

export const dynamic = "force-dynamic";

const AGENT_ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
const OPENCLAW_CMD = "openclaw";
const TEAM_DATA_PATH = path.join(process.cwd(), "data", "team.json");
const OPENCLAW_POWERSHELL_SCRIPT =
  process.platform === "win32" && process.env.APPDATA
    ? path.join(process.env.APPDATA, "npm", "openclaw.ps1")
    : null;
const CLI_NOISE_PREFIXES = [
  "[secrets]",
  "Gateway target:",
  "Source:",
  "Config:",
  "Bind:",
];

type ActionName = "check-in" | "wake" | "review" | "manage";
type ThinkingLevel = "minimal" | "low";

interface TeamOverlayEntry {
  id: string;
  name?: string;
  role?: string;
  description?: string;
  tags?: Array<{ label?: string }>;
  reportsTo?: string;
  canReviewFor?: string[];
  canDelegateTo?: string[];
}

interface ActionContext {
  id: string;
  name: string;
  role: string | null;
  description: string | null;
  tags: string[];
  reportsTo: string | null;
  canReviewFor: string[];
  canDelegateTo: string[];
  canReviewForIds: string[];
  canDelegateToIds: string[];
  model: string | null;
  workspace: string | null;
}

interface StructuredActionFields {
  status: string | null;
  focus: string | null;
  next: string | null;
  blockers: string | null;
  needsFromHuman: string | null;
  decision: string | null;
  handoffTo: string | null;
}

interface TaskPromptContext {
  id: string;
  title: string;
  project: string | null;
  status: string | null;
  priority: string | null;
  dueDate: string | null;
  owner: string | null;
  reviewer: string | null;
  handoff: string | null;
  blockers: string[];
}

interface ProjectPhasePromptContext {
  projectId: string;
  projectTitle: string;
  projectStatus: string | null;
  projectPriority: string | null;
  projectOwner: string | null;
  projectOwnerAgentId: string | null;
  phaseId: string;
  phaseTitle: string;
  phaseStatus: string | null;
  phaseOwner: string | null;
  phaseOwnerAgentId: string | null;
  phaseReviewer: string | null;
  phaseReviewerAgentId: string | null;
  phaseHandoff: string | null;
  phaseHandoffAgentId: string | null;
  dependencies: string[];
  linkedTaskSummary: string | null;
}

interface ManagerTaskMutation {
  title: string;
  assigneeAgentId: string | null;
  reviewerAgentId: string | null;
  handoffToAgentId: string | null;
  priority: "high" | "medium" | "low";
  dueDate: string | null;
  deliverable: string | null;
  dependsOnTitles: string[];
}

interface ManagerActionPlan {
  createTasks: ManagerTaskMutation[];
  phaseUpdate: {
    status?: "pending" | "in_progress" | "blocked" | "completed";
    ownerAgentId?: string | null;
    reviewerAgentId?: string | null;
    handoffToAgentId?: string | null;
  } | null;
}

function runOpenClaw(args: string[]): string {
  const execOptions = {
    encoding: "utf-8" as BufferEncoding,
    timeout: 120000,
    windowsHide: true,
  };

  let result = null as ReturnType<typeof spawnSync> | null;

  if (OPENCLAW_POWERSHELL_SCRIPT) {
    result = spawnSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        OPENCLAW_POWERSHELL_SCRIPT,
        ...args,
      ],
      execOptions
    );
  }

  if (!result || result.error?.message?.includes("ENOENT")) {
    result = spawnSync(OPENCLAW_CMD, args, {
      ...execOptions,
      shell: process.platform === "win32",
    });
  }

  if (result.error) {
    throw result.error;
  }

  const stdoutText =
    typeof result.stdout === "string"
      ? result.stdout
      : result.stdout
      ? result.stdout.toString("utf-8")
      : "";
  const stderrText =
    typeof result.stderr === "string"
      ? result.stderr
      : result.stderr
      ? result.stderr.toString("utf-8")
      : "";

  if (result.status !== 0) {
    throw new Error((stderrText || stdoutText || "openclaw command failed").trim());
  }

  return stdoutText.trim();
}

function stripCliNoise(raw: string): string {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter(
      (line) => !CLI_NOISE_PREFIXES.some((prefix) => line.startsWith(prefix))
    )
    .join("\n")
    .trim();
}

function extractJsonBlock(text: string): string | null {
  const start = text.search(/[\[{]/);
  if (start === -1) return null;

  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === "{" || ch === "[") {
      stack.push(ch === "{" ? "}" : "]");
      continue;
    }

    if ((ch === "}" || ch === "]") && stack.length > 0) {
      const expected = stack[stack.length - 1];
      if (ch === expected) {
        stack.pop();
        if (stack.length === 0) {
          return text.slice(start, i + 1);
        }
      }
    }
  }

  return null;
}

function parseJsonFromCliOutput(raw: string): unknown {
  const cleaned = stripCliNoise(raw);
  const candidates = [cleaned, raw.trim()].filter(Boolean);

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // continue
    }

    const block = extractJsonBlock(candidate);
    if (block) {
      try {
        return JSON.parse(block);
      } catch {
        // continue
      }
    }
  }

  throw new Error("CLI returned non-JSON output");
}

function sanitizeAgentId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!AGENT_ID_RE.test(value)) return null;
  return value;
}

function parseActionName(value: unknown): ActionName {
  return value === "wake" || value === "review" || value === "manage" ? value : "check-in";
}

function parseTaskPromptContext(value: unknown): TaskPromptContext | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const task = value as Record<string, unknown>;
  const id = typeof task.id === "string" && task.id.trim().length > 0 ? task.id.trim() : null;
  const title =
    typeof task.title === "string" && task.title.trim().length > 0
      ? task.title.trim()
      : null;
  if (!id || !title) return null;

  return {
    id,
    title,
    project:
      typeof task.project === "string" && task.project.trim().length > 0
        ? task.project.trim()
        : null,
    status:
      typeof task.status === "string" && task.status.trim().length > 0
        ? task.status.trim()
        : null,
    priority:
      typeof task.priority === "string" && task.priority.trim().length > 0
        ? task.priority.trim()
        : null,
    dueDate:
      typeof task.dueDate === "string" && task.dueDate.trim().length > 0
        ? task.dueDate.trim()
        : null,
    owner:
      typeof task.owner === "string" && task.owner.trim().length > 0
        ? task.owner.trim()
        : null,
    reviewer:
      typeof task.reviewer === "string" && task.reviewer.trim().length > 0
        ? task.reviewer.trim()
        : null,
    handoff:
      typeof task.handoff === "string" && task.handoff.trim().length > 0
        ? task.handoff.trim()
        : null,
    blockers: Array.isArray(task.blockers)
      ? task.blockers.filter(
          (entry): entry is string => typeof entry === "string" && entry.trim().length > 0
        )
      : [],
  };
}

function parseProjectPhasePromptContext(value: unknown): ProjectPhasePromptContext | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const phase = value as Record<string, unknown>;
  const projectId =
    typeof phase.projectId === "string" && phase.projectId.trim().length > 0
      ? phase.projectId.trim()
      : null;
  const projectTitle =
    typeof phase.projectTitle === "string" && phase.projectTitle.trim().length > 0
      ? phase.projectTitle.trim()
      : null;
  const phaseId =
    typeof phase.phaseId === "string" && phase.phaseId.trim().length > 0
      ? phase.phaseId.trim()
      : null;
  const phaseTitle =
    typeof phase.phaseTitle === "string" && phase.phaseTitle.trim().length > 0
      ? phase.phaseTitle.trim()
      : null;

  if (!projectId || !projectTitle || !phaseId || !phaseTitle) return null;

  return {
    projectId,
    projectTitle,
    projectStatus:
      typeof phase.projectStatus === "string" && phase.projectStatus.trim().length > 0
        ? phase.projectStatus.trim()
        : null,
    projectPriority:
      typeof phase.projectPriority === "string" && phase.projectPriority.trim().length > 0
        ? phase.projectPriority.trim()
        : null,
    projectOwner:
      typeof phase.projectOwner === "string" && phase.projectOwner.trim().length > 0
        ? phase.projectOwner.trim()
        : null,
    projectOwnerAgentId:
      typeof phase.projectOwnerAgentId === "string" && phase.projectOwnerAgentId.trim().length > 0
        ? phase.projectOwnerAgentId.trim()
        : null,
    phaseId,
    phaseTitle,
    phaseStatus:
      typeof phase.phaseStatus === "string" && phase.phaseStatus.trim().length > 0
        ? phase.phaseStatus.trim()
        : null,
    phaseOwner:
      typeof phase.phaseOwner === "string" && phase.phaseOwner.trim().length > 0
        ? phase.phaseOwner.trim()
        : null,
    phaseOwnerAgentId:
      typeof phase.phaseOwnerAgentId === "string" && phase.phaseOwnerAgentId.trim().length > 0
        ? phase.phaseOwnerAgentId.trim()
        : null,
    phaseReviewer:
      typeof phase.phaseReviewer === "string" && phase.phaseReviewer.trim().length > 0
        ? phase.phaseReviewer.trim()
        : null,
    phaseReviewerAgentId:
      typeof phase.phaseReviewerAgentId === "string" && phase.phaseReviewerAgentId.trim().length > 0
        ? phase.phaseReviewerAgentId.trim()
        : null,
    phaseHandoff:
      typeof phase.phaseHandoff === "string" && phase.phaseHandoff.trim().length > 0
        ? phase.phaseHandoff.trim()
        : null,
    phaseHandoffAgentId:
      typeof phase.phaseHandoffAgentId === "string" && phase.phaseHandoffAgentId.trim().length > 0
        ? phase.phaseHandoffAgentId.trim()
        : null,
    dependencies: Array.isArray(phase.dependencies)
      ? phase.dependencies.filter(
          (entry): entry is string => typeof entry === "string" && entry.trim().length > 0
        )
      : [],
    linkedTaskSummary:
      typeof phase.linkedTaskSummary === "string" && phase.linkedTaskSummary.trim().length > 0
        ? phase.linkedTaskSummary.trim()
        : null,
  };
}

function listAgentIds(): string[] {
  const output = runOpenClaw(["agents", "list", "--json"]);
  const parsed = parseJsonFromCliOutput(output);
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((item) =>
      item && typeof item === "object" ? (item as { id?: unknown }).id : null
    )
    .filter((id): id is string => typeof id === "string");
}

function summarizeText(raw: string): string {
  const text = stripCliNoise(raw);
  if (!text) return "Action completed.";
  return text.length > 500 ? `${text.slice(0, 500)}...` : text;
}

function normalizeAgentText(text: string): string {
  return text
    .replace(/ï¿½\?\?/g, "'")
    .replace(/\uFFFD/g, "")
    .trim();
}

function summarizeAgentRun(parsed: unknown, rawOutput: string) {
  const fallback = {
    text: summarizeText(rawOutput),
    sessionId: null as string | null,
    durationMs: null as number | null,
    model: null as string | null,
    runId: null as string | null,
  };

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return fallback;
  }

  const root = parsed as Record<string, unknown>;
  const result =
    root.result && typeof root.result === "object"
      ? (root.result as Record<string, unknown>)
      : root;

  const payloads = Array.isArray(result.payloads)
    ? (result.payloads as Array<Record<string, unknown>>)
    : [];

  const payloadText = payloads
    .map((payload) => (typeof payload?.text === "string" ? payload.text.trim() : ""))
    .filter(Boolean)
    .join("\n")
    .trim();

  const meta =
    result.meta && typeof result.meta === "object"
      ? (result.meta as Record<string, unknown>)
      : null;

  const agentMeta =
    meta?.agentMeta && typeof meta.agentMeta === "object"
      ? (meta.agentMeta as Record<string, unknown>)
      : null;

  const durationMs = typeof meta?.durationMs === "number" ? meta.durationMs : null;

  return {
    text: normalizeAgentText(payloadText || fallback.text),
    sessionId:
      agentMeta && typeof agentMeta.sessionId === "string" ? agentMeta.sessionId : null,
    durationMs,
    model: agentMeta && typeof agentMeta.model === "string" ? agentMeta.model : null,
    runId: typeof root.runId === "string" ? root.runId : null,
  };
}

function readTeamOverlay(): TeamOverlayEntry[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(TEAM_DATA_PATH, "utf-8")) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((entry): entry is TeamOverlayEntry => {
      return Boolean(
        entry &&
          typeof entry === "object" &&
          typeof (entry as { id?: unknown }).id === "string"
      );
    });
  } catch {
    return [];
  }
}

function normalizeLabelList(
  value: TeamOverlayEntry["tags"] | TeamOverlayEntry["canReviewFor"] | TeamOverlayEntry["canDelegateTo"]
): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      if (typeof entry === "string") return entry.trim();
      if (entry && typeof entry === "object" && typeof entry.label === "string") {
        return entry.label.trim();
      }
      return "";
    })
    .filter(Boolean);
}

function resolveAgentName(
  agentId: string,
  overlayMap: Map<string, TeamOverlayEntry>,
  summaryMap: Map<string, AgentSummary>
): string {
  return overlayMap.get(agentId)?.name?.trim() || summaryMap.get(agentId)?.name || agentId;
}

async function loadActionContext(agentId: string): Promise<ActionContext> {
  const overlayEntries = readTeamOverlay();
  const overlayMap = new Map(overlayEntries.map((entry) => [entry.id, entry]));
  const overlay = overlayMap.get(agentId);

  let agentSummaries: AgentSummary[] = [];
  try {
    agentSummaries = await getAgentsSummary();
  } catch {
    agentSummaries = [];
  }

  const summaryMap = new Map(agentSummaries.map((entry) => [entry.id, entry]));
  const summary = summaryMap.get(agentId);

  const reviewTargets = normalizeLabelList(overlay?.canReviewFor).map((id) =>
    resolveAgentName(id, overlayMap, summaryMap)
  );
  const delegateTargets = normalizeLabelList(overlay?.canDelegateTo).map((id) =>
    resolveAgentName(id, overlayMap, summaryMap)
  );

  return {
    id: agentId,
    name: overlay?.name?.trim() || summary?.name || agentId,
    role: overlay?.role?.trim() || null,
    description: overlay?.description?.trim() || null,
    tags: normalizeLabelList(overlay?.tags),
    reportsTo:
      overlay?.reportsTo && AGENT_ID_RE.test(overlay.reportsTo)
        ? resolveAgentName(overlay.reportsTo, overlayMap, summaryMap)
        : null,
    canReviewFor: reviewTargets,
    canDelegateTo: delegateTargets,
    canReviewForIds: normalizeLabelList(overlay?.canReviewFor).filter((id) => AGENT_ID_RE.test(id)),
    canDelegateToIds: normalizeLabelList(overlay?.canDelegateTo).filter((id) => AGENT_ID_RE.test(id)),
    model: summary?.model || null,
    workspace: summary?.workspace || null,
  };
}

function formatListForPrompt(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "NONE";
}

function thinkingLevelForAction(action: ActionName): ThinkingLevel {
  return action === "wake" ? "minimal" : "low";
}

function buildPrompt(
  action: ActionName,
  context: ActionContext,
  taskContext?: TaskPromptContext | null,
  projectPhaseContext?: ProjectPhasePromptContext | null
): string {
  const requestLine =
    action === "check-in"
      ? "Mission Control needs a structured operator check-in."
      : action === "review"
      ? "Mission Control needs a structured review decision."
      : action === "manage"
      ? "Mission Control needs a manager action plan with concrete task mutations."
      : "Mission Control needs a structured readiness ping.";
  const statusInstruction =
    action === "check-in"
      ? "STATUS: one short sentence about your current state."
      : action === "review"
      ? "STATUS: one short sentence about review confidence or risk."
      : action === "manage"
      ? "STATUS: one short sentence about the project coordination state."
      : "STATUS: start with READY or BLOCKED, then add one short sentence.";
  const focusInstruction =
    action === "check-in"
      ? "FOCUS: current work or repo area you own right now."
      : action === "review"
      ? "FOCUS: the deliverable, risk, or handoff boundary you reviewed."
      : action === "manage"
      ? "FOCUS: the phase or delivery slice you are decomposing right now."
      : "FOCUS: first repo area you will pick up next if ready.";
  const packetLines = taskContext
    ? [
        "Current task packet:",
        `TASK_ID: ${taskContext.id}`,
        `TASK_TITLE: ${taskContext.title}`,
        `TASK_PROJECT: ${taskContext.project || "NONE"}`,
        `TASK_STATUS: ${taskContext.status || "UNKNOWN"}`,
        `TASK_PRIORITY: ${taskContext.priority || "UNKNOWN"}`,
        `TASK_DUE: ${taskContext.dueDate || "NONE"}`,
        `TASK_OWNER: ${taskContext.owner || "NONE"}`,
        `TASK_REVIEWER: ${taskContext.reviewer || "NONE"}`,
        `TASK_HANDOFF: ${taskContext.handoff || "NONE"}`,
        `TASK_BLOCKERS: ${formatListForPrompt(taskContext.blockers)}`,
        "Anchor your reply to this task first. If you mention work, make it the next concrete step for this task.",
      ]
    : projectPhaseContext
    ? [
        "Current project phase packet:",
        `PROJECT_ID: ${projectPhaseContext.projectId}`,
        `PROJECT_TITLE: ${projectPhaseContext.projectTitle}`,
        `PROJECT_STATUS: ${projectPhaseContext.projectStatus || "UNKNOWN"}`,
        `PROJECT_PRIORITY: ${projectPhaseContext.projectPriority || "UNKNOWN"}`,
        `PROJECT_OWNER: ${projectPhaseContext.projectOwner || "NONE"}`,
        `PHASE_ID: ${projectPhaseContext.phaseId}`,
        `PHASE_TITLE: ${projectPhaseContext.phaseTitle}`,
        `PHASE_STATUS: ${projectPhaseContext.phaseStatus || "UNKNOWN"}`,
        `PHASE_OWNER: ${projectPhaseContext.phaseOwner || "NONE"}`,
        `PHASE_REVIEWER: ${projectPhaseContext.phaseReviewer || "NONE"}`,
        `PHASE_HANDOFF: ${projectPhaseContext.phaseHandoff || "NONE"}`,
        `PHASE_DEPENDENCIES: ${formatListForPrompt(projectPhaseContext.dependencies)}`,
        `LINKED_TASKS: ${projectPhaseContext.linkedTaskSummary || "NONE"}`,
        action === "review"
          ? "Anchor your reply to this phase first. Provide a review decision and make the next handoff explicit."
          : "Anchor your reply to this phase first. If you mention work, make it the next concrete coordination or implementation step for this phase.",
      ]
    : [
        "If you do not have an active concrete task, say what you would inspect next based on your role.",
      ];
  const extraFieldLines =
    action === "review"
      ? [
          "DECISION: APPROVED, CHANGES_REQUESTED, BLOCKED, or NOT_READY.",
          "HANDOFF_TO: next owner after review, or NONE.",
        ]
      : action === "manage"
      ? [
          "Return an ACTIONS_JSON line with one compact JSON object.",
          'ACTIONS_JSON schema: {"createTasks":[{"title":"...","assigneeAgentId":"...","reviewerAgentId":"...","handoffToAgentId":"...","priority":"high|medium|low","dueDate":"YYYY-MM-DD","deliverable":"...","dependsOnTitles":["..."]}],"phaseUpdate":{"status":"pending|in_progress|blocked|completed","ownerAgentId":"...","reviewerAgentId":"...","handoffToAgentId":"..."}}',
          "Create at most 3 tasks.",
          "Use phaseUpdate when you need to reassign the phase, set its reviewer, change handoff, or close/advance the phase.",
          "Every assigneeAgentId must be a real agent id. Prefer delegates from your likely handoffs list when assigning to others.",
          "Do not invent project ids, phase ids, or dependency ids. Use dependsOnTitles only when referencing other tasks you created in the same ACTIONS_JSON.",
          "If no task or phase mutation should happen, return ACTIONS_JSON: {\"createTasks\":[],\"phaseUpdate\":null}.",
        ]
      : [];

  return [
    `You are agent ${context.id} (${context.name}).`,
    requestLine,
    `Role: ${context.role || "OpenClaw agent"}.`,
    `Profile: ${context.description || "No profile summary provided."}`,
    `Tags: ${formatListForPrompt(context.tags)}.`,
    `Reports to: ${context.reportsTo || "NONE"}.`,
    `Review coverage: ${formatListForPrompt(context.canReviewFor)}.`,
    `Likely handoffs: ${formatListForPrompt(context.canDelegateTo)}.`,
    `Configured model: ${context.model || "UNKNOWN"}.`,
    `Workspace: ${context.workspace || "UNKNOWN"}.`,
    ...packetLines,
    "Use plain ASCII only.",
    "Return exactly one line for each field below. Do not add bullets, code fences, or extra commentary.",
    statusInstruction,
    focusInstruction,
    "NEXT: next concrete step inside this workspace.",
    "BLOCKERS: comma-separated blockers, or NONE.",
    "NEEDS_FROM_HUMAN: one concrete ask, or NONE.",
    ...extraFieldLines,
    "Keep every value short and specific.",
  ].join("\n");
}

function normalizeStructuredValue(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || /^none$/i.test(trimmed)) return null;
  return trimmed;
}

function parseStructuredActionFields(text: string): StructuredActionFields | null {
  const parsed: StructuredActionFields = {
    status: null,
    focus: null,
    next: null,
    blockers: null,
    needsFromHuman: null,
    decision: null,
    handoffTo: null,
  };

  let foundStructuredField = false;

  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z_]+):\s*(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    const value = normalizeStructuredValue(rawValue);

    switch (key) {
      case "STATUS":
        parsed.status = value;
        foundStructuredField = true;
        break;
      case "FOCUS":
        parsed.focus = value;
        foundStructuredField = true;
        break;
      case "NEXT":
        parsed.next = value;
        foundStructuredField = true;
        break;
      case "BLOCKERS":
        parsed.blockers = value;
        foundStructuredField = true;
        break;
      case "NEEDS_FROM_HUMAN":
        parsed.needsFromHuman = value;
        foundStructuredField = true;
        break;
      case "DECISION":
        parsed.decision = value;
        foundStructuredField = true;
        break;
      case "HANDOFF_TO":
        parsed.handoffTo = value;
        foundStructuredField = true;
        break;
      default:
        break;
    }
  }

  return foundStructuredField ? parsed : null;
}

function parseManagerActionPlan(text: string): ManagerActionPlan {
  const line = text
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith("ACTIONS_JSON:"));
  if (!line) {
    return { createTasks: [], phaseUpdate: null };
  }

  const rawJson = line.slice("ACTIONS_JSON:".length).trim();
  if (!rawJson) {
    return { createTasks: [], phaseUpdate: null };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error("Manager action returned invalid ACTIONS_JSON.");
  }

  const createTasks = Array.isArray((parsed as { createTasks?: unknown })?.createTasks)
    ? ((parsed as { createTasks: unknown[] }).createTasks)
        .map((entry) => {
          if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
          const task = entry as Record<string, unknown>;
          const title = typeof task.title === "string" ? task.title.trim() : "";
          if (!title) return null;
          return {
            title,
            assigneeAgentId: sanitizeAgentId(task.assigneeAgentId),
            reviewerAgentId: sanitizeAgentId(task.reviewerAgentId),
            handoffToAgentId: sanitizeAgentId(task.handoffToAgentId),
            priority:
              task.priority === "high" || task.priority === "low" ? task.priority : "medium",
            dueDate:
              typeof task.dueDate === "string" && task.dueDate.trim().length > 0
                ? task.dueDate.trim()
                : null,
            deliverable:
              typeof task.deliverable === "string" && task.deliverable.trim().length > 0
                ? task.deliverable.trim()
                : null,
            dependsOnTitles: Array.isArray(task.dependsOnTitles)
              ? task.dependsOnTitles.filter(
                  (value): value is string => typeof value === "string" && value.trim().length > 0
                )
              : [],
          } satisfies ManagerTaskMutation;
        })
        .filter((entry): entry is ManagerTaskMutation => Boolean(entry))
        .slice(0, 3)
    : [];

  const rawPhaseUpdate = (parsed as { phaseUpdate?: unknown })?.phaseUpdate;
  const phaseUpdate =
    rawPhaseUpdate && typeof rawPhaseUpdate === "object" && !Array.isArray(rawPhaseUpdate)
      ? {
          status:
            (rawPhaseUpdate as Record<string, unknown>).status === "pending" ||
            (rawPhaseUpdate as Record<string, unknown>).status === "in_progress" ||
            (rawPhaseUpdate as Record<string, unknown>).status === "blocked" ||
            (rawPhaseUpdate as Record<string, unknown>).status === "completed"
              ? ((rawPhaseUpdate as Record<string, unknown>).status as
                  | "pending"
                  | "in_progress"
                  | "blocked"
                  | "completed")
              : undefined,
          ownerAgentId: sanitizeAgentId((rawPhaseUpdate as Record<string, unknown>).ownerAgentId),
          reviewerAgentId: sanitizeAgentId((rawPhaseUpdate as Record<string, unknown>).reviewerAgentId),
          handoffToAgentId: sanitizeAgentId((rawPhaseUpdate as Record<string, unknown>).handoffToAgentId),
        }
      : null;

  return { createTasks, phaseUpdate };
}

function generateManagedTaskId(tasks: AgentTask[]): string {
  const nums = tasks
    .map((task) => parseInt(task.id.replace("task-", ""), 10))
    .filter((value) => !Number.isNaN(value));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `task-${String(next).padStart(3, "0")}`;
}

async function applyManagerActionPlan(
  plan: ManagerActionPlan,
  context: ActionContext,
  phaseContext: ProjectPhasePromptContext
): Promise<{
  createdTasks: Task[];
  progress: number | null;
  phaseUpdateApplied: ManagerActionPlan["phaseUpdate"];
}> {
  if (plan.createTasks.length === 0 && !plan.phaseUpdate) {
    const tasks = await getAgentTasks();
    const projects = applyDerivedProjectProgress(await getProjects(), tasks);
    return {
      createdTasks: [],
      progress: projects.find((project) => project.id === phaseContext.projectId)?.progress ?? null,
      phaseUpdateApplied: null,
    };
  }

  const [tasks, projects] = await Promise.all([getAgentTasks(), getProjects()]);
  const project = projects.find((entry) => entry.id === phaseContext.projectId);
  if (!project) {
    throw new Error(`Project "${phaseContext.projectId}" was not found.`);
  }
  const phase = project.phases.find((entry) => entry.id === phaseContext.phaseId);
  if (!phase) {
    throw new Error(`Phase "${phaseContext.phaseId}" was not found.`);
  }

  const linkedTasks = tasks.filter((task) => taskLinksToProject(task, project));
  const taskTitles = new Set(linkedTasks.map((task) => task.title.trim().toLowerCase()));
  const createdTasks: AgentTask[] = [];

  for (const mutation of plan.createTasks) {
    const normalizedTitle = mutation.title.trim().toLowerCase();
    if (!normalizedTitle) continue;
    if (taskTitles.has(normalizedTitle)) {
      continue;
    }

    const assigneeAgentId =
      mutation.assigneeAgentId || phaseContext.phaseOwnerAgentId || phaseContext.projectOwnerAgentId;
    if (!assigneeAgentId) {
      throw new Error(`Manager action for "${mutation.title}" is missing an assignee.`);
    }
    if (
      context.canDelegateToIds.length > 0 &&
      assigneeAgentId !== context.id &&
      !context.canDelegateToIds.includes(assigneeAgentId)
    ) {
      throw new Error(`Manager action cannot assign "${mutation.title}" to ${assigneeAgentId}; not in canDelegateTo.`);
    }
    const reviewerAgentId = mutation.reviewerAgentId || phaseContext.phaseReviewerAgentId || undefined;
    const handoffToAgentId = mutation.handoffToAgentId || phaseContext.phaseHandoffAgentId || undefined;
    const policyValidationError = await validateRoutingPolicy({
      ownerAgentId: assigneeAgentId,
      reviewerAgentId,
      handoffToAgentId,
    });
    if (policyValidationError) {
      throw new Error(`Manager action for "${mutation.title}" failed policy validation: ${policyValidationError}`);
    }

    const taskId = generateManagedTaskId([...tasks, ...createdTasks]);
    const dependsOnIds = mutation.dependsOnTitles
      .map((title) =>
        createdTasks.find((task) => task.title.trim().toLowerCase() === title.trim().toLowerCase())?.id ||
        linkedTasks.find((task) => task.title.trim().toLowerCase() === title.trim().toLowerCase())?.id
      )
      .filter((value): value is string => Boolean(value));

    const newTask = normalizeAgentTask({
      id: taskId,
      title: mutation.title,
      status: "pending",
      priority: mutation.priority,
      agent: { id: assigneeAgentId, emoji: "\u{1F464}", name: assigneeAgentId, color: "#8E8E93" },
      project: project.title,
      projectId: project.id,
      dueDate: mutation.dueDate || "",
      assigneeAgentId,
      reviewerAgentId,
      handoffToAgentId,
      blockedByTaskIds: dependsOnIds,
      executionMode: "agent-run",
      runStatus: "queued",
      deliverable: mutation.deliverable || "",
    });

    createdTasks.push(newTask);
    taskTitles.add(normalizedTitle);
  }

  if (createdTasks.length > 0) {
    await saveAgentTasks([...tasks, ...createdTasks]);
  }

  let phaseUpdateApplied: ManagerActionPlan["phaseUpdate"] = null;
  let nextProjectsBase = projects;
  if (plan.phaseUpdate) {
    const nextOwnerAgentId = plan.phaseUpdate.ownerAgentId ?? phase.ownerAgentId;
    const nextReviewerAgentId = plan.phaseUpdate.reviewerAgentId ?? phase.reviewerAgentId;
    const nextHandoffToAgentId = plan.phaseUpdate.handoffToAgentId ?? phase.handoffToAgentId;
    const policyValidationError = await validateRoutingPolicy({
      ownerAgentId: nextOwnerAgentId || undefined,
      reviewerAgentId: nextReviewerAgentId || undefined,
      handoffToAgentId: nextHandoffToAgentId || undefined,
    });
    if (policyValidationError) {
      throw new Error(`Manager phase update failed policy validation: ${policyValidationError}`);
    }

    const nextPhases = project.phases.map((entry) =>
      entry.id === phase.id
        ? {
            ...entry,
            status: plan.phaseUpdate?.status ?? entry.status,
            ownerAgentId: nextOwnerAgentId || undefined,
            reviewerAgentId: nextReviewerAgentId || undefined,
            handoffToAgentId: nextHandoffToAgentId || undefined,
          }
        : entry
    );

    if (plan.phaseUpdate.status === "completed") {
      const nextPendingPhase = nextPhases.find((entry) => entry.id !== phase.id && entry.status === "pending");
      if (nextPendingPhase) {
        nextPhases.splice(
          nextPhases.findIndex((entry) => entry.id === nextPendingPhase.id),
          1,
          {
            ...nextPendingPhase,
            status: "in_progress",
          }
        );
      }
    }

    nextProjectsBase = projects.map((entry) =>
      entry.id === project.id
        ? {
            ...entry,
            phases: nextPhases,
            updatedAgo: "just now",
            updatedBy: context.name,
          }
        : entry
    );

    phaseUpdateApplied = {
      status: plan.phaseUpdate.status,
      ownerAgentId: nextOwnerAgentId || null,
      reviewerAgentId: nextReviewerAgentId || null,
      handoffToAgentId: nextHandoffToAgentId || null,
    };
  }

  const nextProjects = applyDerivedProjectProgress(nextProjectsBase, [...tasks, ...createdTasks]);
  const nextProject = nextProjects.find((entry) => entry.id === phaseContext.projectId) || null;
  if (nextProject) {
    await saveProjects(nextProjects);
  }

  return {
    createdTasks: createdTasks as Task[],
    progress: nextProject?.progress ?? null,
    phaseUpdateApplied,
  };
}

function derivePacketRunStatus(
  action: ActionName,
  fields: StructuredActionFields | null,
  text: string
): "queued" | "running" | "needs_review" | "done" | "failed" {
  const signalText = [
    fields?.status || "",
    fields?.blockers || "",
    fields?.needsFromHuman || "",
    fields?.decision || "",
    text,
  ]
    .join(" ")
    .toLowerCase();

  if (action === "review") {
    const decisionText = (fields?.decision || "").toLowerCase();

    if (decisionText.includes("approved")) {
      return "done";
    }

    if (decisionText.includes("block") || decisionText.includes("not_ready") || signalText.includes("blocked")) {
      return "failed";
    }

    if (fields?.blockers || fields?.needsFromHuman || decisionText.includes("change") || decisionText.includes("rework")) {
      return "running";
    }

    return "running";
  }

  if (action === "manage") {
    if (fields?.blockers || fields?.needsFromHuman || signalText.includes("blocked")) {
      return "needs_review";
    }
    return "running";
  }

  if (fields?.blockers || fields?.needsFromHuman || signalText.includes("blocked")) {
    return "needs_review";
  }

  return action === "wake" ? "queued" : "running";
}

function buildPacketDeliverableSummary(
  fields: StructuredActionFields | null,
  fallbackText: string
): string {
  const parts = [
    fields?.focus ? `Focus: ${fields.focus}` : null,
    fields?.next ? `Next: ${fields.next}` : null,
    fields?.blockers ? `Blockers: ${fields.blockers}` : null,
    fields?.needsFromHuman ? `Needs: ${fields.needsFromHuman}` : null,
    fields?.decision ? `Decision: ${fields.decision}` : null,
    fields?.handoffTo ? `Handoff: ${fields.handoffTo}` : null,
  ].filter((entry): entry is string => Boolean(entry));

  const summary = parts.length > 0 ? parts.join(" | ") : fallbackText;
  return summary.length > 500 ? `${summary.slice(0, 500)}...` : summary;
}

function toStoredRunIntent(action: ActionName): TaskRunIntent {
  if (action === "check-in") return "agent_check_in";
  if (action === "wake") return "agent_wake";
  if (action === "review") return "review";
  return "debug";
}

function toStoredRunAction(action: ActionName): "check-in" | "wake" | "review" | undefined {
  if (action === "check-in" || action === "wake" || action === "review") {
    return action;
  }
  return undefined;
}

function toStoredActionFields(fields: StructuredActionFields | null) {
  if (!fields) return null;

  const normalized = {
    status: fields.status || undefined,
    focus: fields.focus || undefined,
    next: fields.next || undefined,
    blockers: fields.blockers || undefined,
    needsFromHuman: fields.needsFromHuman || undefined,
    decision: fields.decision || undefined,
    handoffTo: fields.handoffTo || undefined,
  };

  return Object.values(normalized).some(Boolean) ? normalized : null;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const id = sanitizeAgentId(body.id);
    const action = parseActionName(body.action);
    const taskContext = parseTaskPromptContext(body.task);
    const projectPhaseContext = parseProjectPhasePromptContext(body.projectPhase);

    if (!id) {
      return NextResponse.json({ error: "Missing or invalid id" }, { status: 400 });
    }

    if (taskContext && projectPhaseContext) {
      return NextResponse.json(
        { error: "Provide either task or projectPhase context, not both" },
        { status: 400 }
      );
    }

    const agents = listAgentIds();
    if (!agents.includes(id)) {
      return NextResponse.json({ error: `Unknown agent: ${id}` }, { status: 404 });
    }

    const context = await loadActionContext(id);
    const thinking = thinkingLevelForAction(action);
    const startedAt = Date.now();
    const output = runOpenClaw([
      "agent",
      "--agent",
      id,
      "--message",
      buildPrompt(action, context, taskContext, projectPhaseContext),
      "--thinking",
      thinking,
      "--timeout",
      "90",
      "--json",
    ]);

    const parsed = parseJsonFromCliOutput(output);
    const summary = summarizeAgentRun(parsed, output);
    const fields = parseStructuredActionFields(summary.text);
    const managerPlan = action === "manage" ? parseManagerActionPlan(summary.text) : null;
    const timestamp = new Date().toISOString();
    const managerResult =
      action === "manage" && projectPhaseContext
        ? await applyManagerActionPlan(managerPlan || { createTasks: [], phaseUpdate: null }, context, projectPhaseContext)
        : null;

    const runDeliverable =
      action === "manage" && managerResult
        ? buildPacketDeliverableSummary(
            fields,
            [
              managerResult.createdTasks.length > 0
                ? `Created ${managerResult.createdTasks.length} managed task(s): ${managerResult.createdTasks.map((task) => task.title).join(", ")}`
                : null,
              managerResult.phaseUpdateApplied
                ? `Updated phase: status=${managerResult.phaseUpdateApplied.status || "unchanged"}, owner=${managerResult.phaseUpdateApplied.ownerAgentId || "unchanged"}, reviewer=${managerResult.phaseUpdateApplied.reviewerAgentId || "unchanged"}, handoff=${managerResult.phaseUpdateApplied.handoffToAgentId || "unchanged"}`
                : null,
              managerResult.createdTasks.length === 0 && !managerResult.phaseUpdateApplied
                ? "Manager action completed without creating new tasks."
                : null,
            ]
              .filter(Boolean)
              .join(" | ")
          )
        : buildPacketDeliverableSummary(fields, summary.text);

    if (taskContext) {
      await recordTaskRun({
        taskId: taskContext.id,
        taskTitle: taskContext.title,
        userAgent: request.headers.get("user-agent") || undefined,
        run: {
          kind: "agent_packet",
          intent: toStoredRunIntent(action),
          action: toStoredRunAction(action),
          timestamp,
          runStatus: derivePacketRunStatus(action, fields, summary.text),
          executionMode: "agent-run",
          deliverable: runDeliverable,
          text: summary.text,
          agentId: context.id,
          agentName: context.name,
          model: summary.model || context.model || undefined,
          sessionId: summary.sessionId || undefined,
          runId: summary.runId || undefined,
          thinking,
          fields: toStoredActionFields(fields),
        },
      });
    }

    if (projectPhaseContext) {
      await recordProjectPhaseRun({
        projectId: projectPhaseContext.projectId,
        projectTitle: projectPhaseContext.projectTitle,
        phaseId: projectPhaseContext.phaseId,
        phaseTitle: projectPhaseContext.phaseTitle,
        userAgent: request.headers.get("user-agent") || undefined,
        run: {
          kind: "agent_packet",
          intent: toStoredRunIntent(action),
          action: toStoredRunAction(action),
          timestamp,
          runStatus: derivePacketRunStatus(action, fields, summary.text),
          executionMode: "agent-run",
          deliverable: runDeliverable,
          text: summary.text,
          agentId: context.id,
          agentName: context.name,
          model: summary.model || context.model || undefined,
          sessionId: summary.sessionId || undefined,
          runId: summary.runId || undefined,
          thinking,
          fields: toStoredActionFields(fields),
        },
      });
    }

    return NextResponse.json({
      ok: true,
      id,
      action,
      thinking,
      ...summary,
      fields,
      appliedMutations:
        managerResult
          ? {
              createdTasks: managerResult.createdTasks.map((task) => ({
                id: task.id,
                title: task.title,
                assigneeAgentId: task.assigneeAgentId || null,
                reviewerAgentId: task.reviewerAgentId || null,
              })),
              phaseUpdate: managerResult.phaseUpdateApplied,
              projectProgress: managerResult.progress,
            }
          : null,
      durationMs: summary.durationMs ?? Date.now() - startedAt,
      timestamp,
      taskId: taskContext?.id || null,
      projectId: projectPhaseContext?.projectId || null,
      phaseId: projectPhaseContext?.phaseId || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to run team action";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
