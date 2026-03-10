import CalendarPageClient from "./CalendarPageClient";
import { getAgentTasks } from "@/lib/agent-tasks-data";

export const dynamic = "force-dynamic";

async function getInitialTasks() {
  try {
    return await getAgentTasks();
  } catch {
    return [];
  }
}

export default async function CalendarPage() {
  const initialTasks = await getInitialTasks();
  return <CalendarPageClient initialTasks={initialTasks} />;
}
