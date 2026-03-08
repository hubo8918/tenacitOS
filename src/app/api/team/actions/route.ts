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

function parseJsonFromCliOutput(raw: string): unknown {
  const text = raw.trim();
  if (!text) return null;

  const parsedCandidates: unknown[] = [];

  try {
    parsedCandidates.push(JSON.parse(text));
  } catch {
    // continue
  }

  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const snippet = lines.slice(i).join("\n").trim();
    if (!snippet.startsWith("{") && !snippet.startsWith("[")) continue;

    try {
      parsedCandidates.push(JSON.parse(snippet));
    } catch {
      // continue trying later lines
    }
  }

  if (parsedCandidates.length === 0) {
    throw new Error("CLI returned non-JSON output");
  }

  const preferred = parsedCandidates.find((candidate) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      return false;
    }

    const obj = candidate as Record<string, unknown>;
    return (
      "result" in obj ||
      "runId" in obj ||
      ("status" in obj && ("summary" in obj || "payloads" in obj))
    );
  });

  return preferred ?? parsedCandidates[0];
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
    .map((item) => (item && typeof item === "object" ? (item as { id?: unknown }).id : null))
    .filter((id): id is string => typeof id === "string");
}

function summarizeReply(
  parsed: unknown,
  rawOutput?: string
): {
  text: string;
  sessionId: string | null;
  durationMs: number | null;
  model: string | null;
} {
  const fallback = {
    text: "Action completed.",
    sessionId: null,
    durationMs: null,
    model: null,
  };

  if (!parsed || typeof parsed !== "object") return fallback;

  const root = parsed as Record<string, unknown>;
  const result =
    root.result && typeof root.result === "object"
      ? (root.result as Record<string, unknown>)
      : null;

  const payloads =
    result && Array.isArray(result.payloads)
      ? (result.payloads as Array<Record<string, unknown>>)
      : [];

  const text = payloads
    .map((payload) => (typeof payload?.text === "string" ? payload.text.trim() : ""))
    .filter(Boolean)
    .join("\n")
    .trim();

  const agentMeta =
    result?.meta &&
    typeof result.meta === "object" &&
    (result.meta as Record<string, unknown>).agentMeta &&
    typeof (result.meta as Record<string, unknown>).agentMeta === "object"
      ? ((result.meta as Record<string, unknown>).agentMeta as Record<string, unknown>)
      : null;

  const durationMs =
    result?.meta &&
    typeof result.meta === "object" &&
    typeof (result.meta as Record<string, unknown>).durationMs === "number"
      ? ((result.meta as Record<string, unknown>).durationMs as number)
      : null;

  let outputText = text || (typeof root.summary === "string" ? root.summary : "");

  if (!outputText && rawOutput) {
    const match = rawOutput.match(/"text"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
    if (match?.[1]) {
      outputText = match[1]
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "")
        .replace(/\\\"/g, '"');
    }
  }

  if (!outputText) {
    outputText = fallback.text;
  }

  return {
    text: outputText.length > 500 ? `${outputText.slice(0, 500)}…` : outputText,
    sessionId:
      agentMeta && typeof agentMeta.sessionId === "string" ? agentMeta.sessionId : null,
    durationMs,
    model: agentMeta && typeof agentMeta.model === "string" ? agentMeta.model : null,
  };
}

function buildPrompt(action: string, agentId: string): string {
  if (action === "check-in") {
    return [
      `You are agent ${agentId}.`,
      "Quick team check-in:",
      "Reply in 1-2 short sentences with what you're currently focused on and your next step.",
    ].join("\n");
  }

  return [
    `You are agent ${agentId}.`,
    "Wake up and confirm readiness.",
    "Reply in one short sentence ending with READY.",
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
    const summary = summarizeReply(parsed);

    return NextResponse.json({
      ok: true,
      id,
      action,
      ...summary,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to run team action";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
