import { NextRequest, NextResponse } from "next/server";

import {
  getRecentWorkItemReviewDecisions,
  getWorkItemDashboardData,
  getWorkItemEntity,
  getWorkItemInbox,
} from "@/lib/work-items";
import type { WorkItemKind, WorkItemRunStatus } from "@/lib/work-item-types";

function isWorkItemKind(value: string | null): value is WorkItemKind {
  return value === "task" || value === "phase";
}

function isRunStatus(value: string | null): value is WorkItemRunStatus {
  return value === "idle" ||
    value === "queued" ||
    value === "running" ||
    value === "needs_review" ||
    value === "done" ||
    value === "failed";
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view") || "inbox";
    const reviewer = searchParams.get("reviewer") || undefined;
    const status = searchParams.get("status");
    const limitParam = Number.parseInt(searchParams.get("limit") || "8", 10);
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 8;

    if (view === "recent-decisions") {
      const decisions = await getRecentWorkItemReviewDecisions({
        reviewer,
        limit,
      });
      return NextResponse.json({ decisions });
    }

    if (view === "bootstrap") {
      const dashboard = await getWorkItemDashboardData({
        reviewer,
        status: isRunStatus(status) ? status : undefined,
        decisionsLimit: limit,
      });
      return NextResponse.json(dashboard);
    }

    if (view === "entity") {
      const kind = searchParams.get("kind");
      const itemId = searchParams.get("itemId") || "";
      const projectId = searchParams.get("projectId") || undefined;

      if (!isWorkItemKind(kind) || !itemId) {
        return NextResponse.json({ error: "Missing or invalid kind/itemId" }, { status: 400 });
      }

      const entity = await getWorkItemEntity({ kind, itemId, projectId });
      return NextResponse.json(entity);
    }

    const items = await getWorkItemInbox({
      reviewer,
      status: isRunStatus(status) ? status : undefined,
    });

    return NextResponse.json({
      items,
      counts: {
        total: items.length,
        task: items.filter((item) => item.kind === "task").length,
        phase: items.filter((item) => item.kind === "phase").length,
        unassigned: items.filter((item) => !item.reviewerAgentId).length,
      },
    });
  } catch (error) {
    console.error("[work-items] Failed to load work items:", error);
    return NextResponse.json({ error: "Failed to load work items" }, { status: 500 });
  }
}
