import TeamPageClient from "./TeamPageClient";
import type { TeamAgent } from "@/data/mockTeamData";
import { getTeamForDisplay } from "@/app/api/team/route";
import { getWorkItemDashboardData } from "@/lib/work-items";
import type { WorkItemDashboardData } from "@/lib/work-item-types";

export const dynamic = "force-dynamic";

const REVIEW_FOCUS_ALL = "__all__";
const TEAM_VIEW_INBOX = "inbox";

function readSearchParam(
  value: string | string[] | undefined
): string {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : "";
  }
  return typeof value === "string" ? value : "";
}

async function getInitialTeam(): Promise<TeamAgent[]> {
  try {
    return await getTeamForDisplay();
  } catch {
    return [];
  }
}

function getDefaultReviewFocus(team: TeamAgent[]): string {
  return team.find((agent) => agent.id === "henry")?.id || team[0]?.id || REVIEW_FOCUS_ALL;
}

async function getInitialDashboard(reviewer: string): Promise<WorkItemDashboardData> {
  try {
    return await getWorkItemDashboardData({
      reviewer,
      decisionsLimit: 6,
    });
  } catch {
    return {
      items: [],
      counts: {
        total: 0,
        task: 0,
        phase: 0,
        unassigned: 0,
      },
      decisions: [],
    };
  }
}

export default async function TeamPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const initialTeam = await getInitialTeam();
  const requestedReviewFocus = readSearchParam(resolvedSearchParams.reviewer).trim();
  const requestedView = readSearchParam(resolvedSearchParams.view).trim() === "agents" ? "agents" : TEAM_VIEW_INBOX;
  const initialReviewFocus =
    requestedReviewFocus === REVIEW_FOCUS_ALL ||
    requestedReviewFocus === "__unassigned__" ||
    initialTeam.some((agent) => agent.id === requestedReviewFocus)
      ? requestedReviewFocus || getDefaultReviewFocus(initialTeam)
      : getDefaultReviewFocus(initialTeam);
  const initialDashboard = await getInitialDashboard(initialReviewFocus);

  return (
    <TeamPageClient
      initialTeam={initialTeam}
      initialDashboard={initialDashboard}
      initialReviewFocus={initialReviewFocus}
      initialView={requestedView}
    />
  );
}
