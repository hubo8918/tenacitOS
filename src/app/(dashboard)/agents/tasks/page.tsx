import TasksPageClient from "./TasksPageClient";
import { getAgentTasks } from "@/lib/agent-tasks-data";

export const dynamic = "force-dynamic";

async function getInitialTasks() {
  try {
    return await getAgentTasks();
  } catch {
    return [];
  }
}

export default async function TasksPage() {
  const initialTasks = await getInitialTasks();
  return <TasksPageClient initialTasks={initialTasks} />;
}
