import TeamPageClient from "./TeamPageClient";
import type { TeamAgent } from "@/data/mockTeamData";
import { getTeamForDisplay } from "@/app/api/team/route";
import { getWorkItemDashboardData } from "@/lib/work-items";
import type { WorkItemDashboardData } from "@/lib/work-item-types";

export const dynamic = "force-dynamic";

const REVIEW_FOCUS_ALL = "__all__";

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

export default async function TeamPage() {
  const initialTeam = await getInitialTeam();
  const initialReviewFocus = getDefaultReviewFocus(initialTeam);
  const initialDashboard = await getInitialDashboard(initialReviewFocus);

  return (
    <TeamPageClient
      initialTeam={initialTeam}
      initialDashboard={initialDashboard}
      initialReviewFocus={initialReviewFocus}
    />
  );
}
