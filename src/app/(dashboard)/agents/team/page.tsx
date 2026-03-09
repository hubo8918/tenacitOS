import { headers } from "next/headers";
import TeamPageClient from "./TeamPageClient";
import type { TeamAgent } from "@/data/mockTeamData";

export const dynamic = "force-dynamic";

async function getInitialTeam(): Promise<TeamAgent[]> {
  try {
    const requestHeaders = await headers();
    const host = requestHeaders.get("host");
    if (!host) return [];

    const protocol = requestHeaders.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
    const cookie = requestHeaders.get("cookie") || "";

    const response = await fetch(`${protocol}://${host}/api/team`, {
      headers: cookie ? { cookie } : undefined,
      cache: "no-store",
    });

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as { team?: TeamAgent[] };
    return Array.isArray(data.team) ? data.team : [];
  } catch {
    return [];
  }
}

export default async function TeamPage() {
  const initialTeam = await getInitialTeam();
  return <TeamPageClient initialTeam={initialTeam} />;
}
