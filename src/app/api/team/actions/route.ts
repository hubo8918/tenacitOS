import { NextRequest, NextResponse } from "next/server";
import { spawnSync } from "child_process";
import path from "path";

export const dynamic = "force-dynamic";

const AGENT_ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
const OPENCLAW_CMD = "openclaw";
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
  return text.length > 500 ? `${text.slice(0, 500)}…` : text;
}

function normalizeAgentText(text: string): string {
  return text
    .replace(/�\?\?/g, "'")
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

  const meta = result.meta && typeof result.meta === "object"
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

function buildPrompt(action: string, agentId: string): string {
  if (action === "check-in") {
    return [
      `You are agent ${agentId}.`,
      "Quick team check-in:",
      "Reply in 1-2 short sentences with what you're currently focused on and your next step.",
      "Use plain ASCII punctuation and avoid smart quotes.",
    ].join("\n");
  }

  return [
    `You are agent ${agentId}.`,
    "Wake up and confirm readiness.",
    "Reply in one short sentence ending with READY.",
    "Use plain ASCII punctuation and avoid smart quotes.",
  ].join("\n");
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const id = sanitizeAgentId(body.id);
    const action = typeof body.action === "string" ? body.action : "check-in";

    if (!id) {
      return NextResponse.json({ error: "Missing or invalid id" }, { status: 400 });
    }

    if (!action || !["check-in", "wake"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Expected check-in or wake." },
        { status: 400 }
      );
    }

    const agents = listAgentIds();
    if (!agents.includes(id)) {
      return NextResponse.json({ error: `Unknown agent: ${id}` }, { status: 404 });
    }

    const startedAt = Date.now();
    const output = runOpenClaw([
      "agent",
      "--agent",
      id,
      "--message",
      buildPrompt(action, id),
      "--thinking",
      "minimal",
      "--timeout",
      "90",
      "--json",
    ]);

    const parsed = parseJsonFromCliOutput(output);
    const summary = summarizeAgentRun(parsed, output);

    return NextResponse.json({
      ok: true,
      id,
      action,
      ...summary,
      durationMs: summary.durationMs ?? Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to run team action";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
