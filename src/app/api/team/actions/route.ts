import { NextRequest, NextResponse } from "next/server";
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";

import { getAgentsSummary, type AgentSummary } from "@/lib/agents-data";

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

type ActionName = "check-in" | "wake";
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
  model: string | null;
  workspace: string | null;
}

interface StructuredActionFields {
  status: string | null;
  focus: string | null;
  next: string | null;
  blockers: string | null;
  needsFromHuman: string | null;
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
    model: summary?.model || null,
    workspace: summary?.workspace || null,
  };
}

function formatListForPrompt(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "NONE";
}

function thinkingLevelForAction(action: ActionName): ThinkingLevel {
  return action === "check-in" ? "low" : "minimal";
}

function buildPrompt(action: ActionName, context: ActionContext): string {
  const requestLine =
    action === "check-in"
      ? "Mission Control needs a structured operator check-in."
      : "Mission Control needs a structured readiness ping.";
  const statusInstruction =
    action === "check-in"
      ? "STATUS: one short sentence about your current state."
      : "STATUS: start with READY or BLOCKED, then add one short sentence.";
  const focusInstruction =
    action === "check-in"
      ? "FOCUS: current work or repo area you own right now."
      : "FOCUS: first repo area you will pick up next if ready.";

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
    "If you do not have an active concrete task, say what you would inspect next based on your role.",
    "Use plain ASCII only.",
    "Return exactly one line for each field below. Do not add bullets, code fences, or extra commentary.",
    statusInstruction,
    focusInstruction,
    "NEXT: next concrete step inside this workspace.",
    "BLOCKERS: comma-separated blockers, or NONE.",
    "NEEDS_FROM_HUMAN: one concrete ask, or NONE.",
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
      default:
        break;
    }
  }

  return foundStructuredField ? parsed : null;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const id = sanitizeAgentId(body.id);
    const action = body.action === "wake" ? "wake" : "check-in";

    if (!id) {
      return NextResponse.json({ error: "Missing or invalid id" }, { status: 400 });
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
      buildPrompt(action, context),
      "--thinking",
      thinking,
      "--timeout",
      "90",
      "--json",
    ]);

    const parsed = parseJsonFromCliOutput(output);
    const summary = summarizeAgentRun(parsed, output);
    const fields = parseStructuredActionFields(summary.text);

    return NextResponse.json({
      ok: true,
      id,
      action,
      thinking,
      ...summary,
      fields,
      durationMs: summary.durationMs ?? Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to run team action";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
