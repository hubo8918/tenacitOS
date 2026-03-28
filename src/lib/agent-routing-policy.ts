import fs from "fs/promises";
import path from "path";

import { teamAgents } from "@/data/mockTeamData";

const TEAM_DATA_PATH = path.join(process.cwd(), "data", "team.json");

interface TeamOverlayEntry {
  id?: string;
  canReviewFor?: unknown;
  canDelegateTo?: unknown;
}

interface RoutingPolicy {
  id: string;
  canReviewFor: string[];
  canDelegateTo: string[];
}

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

export async function getRoutingPolicies(): Promise<Map<string, RoutingPolicy>> {
  const base = new Map(
    teamAgents.map((agent) => [
      agent.id,
      {
        id: agent.id,
        canReviewFor: agent.canReviewFor || [],
        canDelegateTo: agent.canDelegateTo || [],
      },
    ])
  );

  try {
    const raw = await fs.readFile(TEAM_DATA_PATH, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return base;
    }

    for (const entry of parsed as TeamOverlayEntry[]) {
      if (!entry?.id || typeof entry.id !== "string") continue;
      base.set(entry.id, {
        id: entry.id,
        canReviewFor: toStringList(entry.canReviewFor),
        canDelegateTo: toStringList(entry.canDelegateTo),
      });
    }
  } catch {
    return base;
  }

  return base;
}

export async function validateRoutingPolicy(options: {
  ownerAgentId?: string;
  reviewerAgentId?: string;
  handoffToAgentId?: string;
}): Promise<string | null> {
  const { ownerAgentId, reviewerAgentId, handoffToAgentId } = options;
  const policies = await getRoutingPolicies();

  if (ownerAgentId && reviewerAgentId) {
    const reviewerPolicy = policies.get(reviewerAgentId);
    if (
      reviewerPolicy &&
      reviewerPolicy.canReviewFor.length > 0 &&
      !reviewerPolicy.canReviewFor.includes(ownerAgentId)
    ) {
      return `${reviewerAgentId} is not configured to review work for ${ownerAgentId}.`;
    }
  }

  if (ownerAgentId && handoffToAgentId) {
    const ownerPolicy = policies.get(ownerAgentId);
    if (
      ownerPolicy &&
      ownerPolicy.canDelegateTo.length > 0 &&
      !ownerPolicy.canDelegateTo.includes(handoffToAgentId)
    ) {
      return `${ownerAgentId} is not configured to delegate work to ${handoffToAgentId}.`;
    }
  }

  return null;
}
