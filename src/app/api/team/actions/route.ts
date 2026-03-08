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

function summarizeText(raw: string): string {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter(
      (line) =>
        !line.startsWith("[secrets]") &&
        !line.startsWith("Gateway target:") &&
        !line.startsWith("Source:") &&
        !line.startsWith("Config:") &&
        !line.startsWith("Bind:")
    );

  const text = lines.join("\n").trim();
  if (!text) return "Action completed.";

  const compact = text.length > 500 ? `${text.slice(0, 500)}…` : text;
  return compact;
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
    ]);

    return NextResponse.json({
      ok: true,
      id,
      action,
      text: summarizeText(output),
      sessionId: null,
      durationMs: Date.now() - startedAt,
      model: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to run team action";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
