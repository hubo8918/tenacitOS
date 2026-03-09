import AgentsPageClient from "./AgentsPageClient";
import { getAgentsSummary } from "@/lib/agents-data";

export const dynamic = "force-dynamic";

async function getInitialAgents() {
  try {
    return await getAgentsSummary();
  } catch {
    return [];
  }
}

export default async function AgentsPage() {
  const initialAgents = await getInitialAgents();
  return <AgentsPageClient initialAgents={initialAgents} />;
}
