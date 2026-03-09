import fs from "fs/promises";
import path from "path";

export interface AgentTask {
  id: string;
  title: string;
  status: "pending" | "in_progress" | "completed" | "blocked";
  priority: "high" | "medium" | "low";
  agent: {
    emoji: string;
    name: string;
    color: string;
  };
  project: string;
  dueDate: string;
}

const DATA_PATH = path.join(process.cwd(), "data", "agent-tasks.json");

export async function getAgentTasks(): Promise<AgentTask[]> {
  try {
    const data = await fs.readFile(DATA_PATH, "utf-8");
    return JSON.parse(data) as AgentTask[];
  } catch {
    return [];
  }
}
