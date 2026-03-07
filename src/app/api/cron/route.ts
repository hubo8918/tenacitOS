import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { OPENCLAW_CONFIG, OPENCLAW_DIR } from "@/lib/paths";

const CRON_JOBS_FILE = path.join(process.cwd(), "data", "cron-jobs.json");
const REAL_CRON_JOBS_FILE = path.join(OPENCLAW_DIR, "cron", "jobs.json");

function runCron(args: string[]) {
  const cmd = `openclaw cron ${args.join(" ")}`;
  return execSync(cmd, {
    timeout: 10000,
    encoding: "utf-8",
    windowsHide: true,
  });
}

function getGatewayConfig() {
  try {
    const configRaw = fs.readFileSync(OPENCLAW_CONFIG, "utf-8");
    const config = JSON.parse(configRaw);
    return {
      token: config.gateway?.auth?.token || "",
      port: config.gateway?.port || 18789,
    };
  } catch {
    return { token: "", port: 18789 };
  }
}

function readLocalCronJobs() {
  try {
    const raw = fs.readFileSync(CRON_JOBS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeLocalCronJobs(jobs: unknown[]) {
  fs.writeFileSync(CRON_JOBS_FILE, JSON.stringify(jobs, null, 2));
}

// GET: List all cron jobs — try CLI first, fall back to local JSON
export async function GET() {
  // Try the openclaw CLI first
  try {
    const output = runCron(["list", "--json", "--all"]);
    const data = JSON.parse(output);
    const jobs = (data.jobs || []).map((job: Record<string, unknown>) => ({
      id: job.id,
      agentId: job.agentId || "main",
      name: job.name || "Unnamed",
      enabled: job.enabled ?? true,
      createdAtMs: job.createdAtMs,
      updatedAtMs: job.updatedAtMs,
      schedule: job.schedule,
      sessionTarget: job.sessionTarget,
      payload: job.payload,
      delivery: job.delivery,
      state: job.state,
      description: formatDescription(job),
      scheduleDisplay: formatSchedule(job.schedule as Record<string, unknown>),
      timezone: (job.schedule as Record<string, string>)?.tz || "UTC",
      nextRun: (job.state as Record<string, unknown>)?.nextRunAtMs
        ? new Date((job.state as Record<string, number>).nextRunAtMs).toISOString()
        : null,
      lastRun: (job.state as Record<string, unknown>)?.lastRunAtMs
        ? new Date((job.state as Record<string, number>).lastRunAtMs).toISOString()
        : null,
    }));
    return NextResponse.json(jobs);
  } catch {
    // CLI not available — fall back to real cron jobs.json
  }

  // Try reading the real openclaw cron jobs file
  try {
    const raw = fs.readFileSync(REAL_CRON_JOBS_FILE, "utf-8");
    const data = JSON.parse(raw);
    const jobs = (data.jobs || []).map((job: Record<string, unknown>) => ({
      id: job.id,
      agentId: job.agentId || "main",
      name: job.name || "Unnamed",
      enabled: job.enabled ?? true,
      createdAtMs: job.createdAtMs,
      updatedAtMs: job.updatedAtMs,
      schedule: job.schedule,
      sessionTarget: job.sessionTarget,
      payload: job.payload,
      delivery: job.delivery,
      state: job.state,
      description: formatDescription(job),
      scheduleDisplay: formatSchedule(job.schedule as Record<string, unknown>),
      timezone: (job.schedule as Record<string, string>)?.tz || "UTC",
      nextRun: (job.state as Record<string, unknown>)?.nextRunAtMs
        ? new Date((job.state as Record<string, number>).nextRunAtMs).toISOString()
        : null,
      lastRun: (job.state as Record<string, unknown>)?.lastRunAtMs
        ? new Date((job.state as Record<string, number>).lastRunAtMs).toISOString()
        : null,
    }));
    return NextResponse.json(jobs);
  } catch {
    // Real cron file not available — fall back to local example JSON
  }

  try {
    const jobs = readLocalCronJobs();
    return NextResponse.json(jobs);
  } catch (error) {
    console.error("Error fetching cron jobs:", error);
    return NextResponse.json(
      { error: "Failed to fetch cron jobs" },
      { status: 500 }
    );
  }
}

function formatDescription(job: Record<string, unknown>): string {
  const payload = job.payload as Record<string, unknown>;
  if (!payload) return "";
  if (payload.kind === "agentTurn") {
    const msg = (payload.message as string) || "";
    return msg.length > 120 ? msg.substring(0, 120) + "..." : msg;
  }
  if (payload.kind === "systemEvent") {
    const text = (payload.text as string) || "";
    return text.length > 120 ? text.substring(0, 120) + "..." : text;
  }
  return "";
}

function formatSchedule(schedule: Record<string, unknown>): string {
  if (!schedule) return "Unknown";
  switch (schedule.kind) {
    case "cron":
      return `${schedule.expr}${schedule.tz ? ` (${schedule.tz})` : ""}`;
    case "every":
      const ms = schedule.everyMs as number;
      if (ms >= 3600000) return `Every ${ms / 3600000}h`;
      if (ms >= 60000) return `Every ${ms / 60000}m`;
      return `Every ${ms / 1000}s`;
    case "at":
      return `Once at ${schedule.at}`;
    default:
      return JSON.stringify(schedule);
  }
}

// PUT: Toggle enable/disable a cron job
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, enabled } = body;

    if (!id) {
      return NextResponse.json({ error: "Job ID is required" }, { status: 400 });
    }

    // Try CLI first
    try {
      const action = enabled ? "enable" : "disable";
      runCron([action, id]);
      return NextResponse.json({ success: true, id, enabled });
    } catch {
      // CLI not available — update local JSON
    }

    const jobs = readLocalCronJobs();
    const job = jobs.find((j: Record<string, unknown>) => j.id === id);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    job.enabled = enabled;
    job.updatedAt = new Date().toISOString();
    writeLocalCronJobs(jobs);
    return NextResponse.json({ success: true, id, enabled });
  } catch (error) {
    console.error("Error updating cron job:", error);
    return NextResponse.json(
      { error: "Failed to update cron job" },
      { status: 500 }
    );
  }
}

// DELETE: Remove a cron job
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Job ID is required" }, { status: 400 });
    }

    // Try CLI first
    try {
      runCron(["rm", id]);
      return NextResponse.json({ success: true, deleted: id });
    } catch {
      // CLI not available — update local JSON
    }

    const jobs = readLocalCronJobs();
    const filtered = jobs.filter((j: Record<string, unknown>) => j.id !== id);
    writeLocalCronJobs(filtered);
    return NextResponse.json({ success: true, deleted: id });
  } catch (error) {
    console.error("Error deleting cron job:", error);
    return NextResponse.json(
      { error: "Failed to delete cron job" },
      { status: 500 }
    );
  }
}
