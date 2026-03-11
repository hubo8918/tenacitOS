export interface Task {
  id: string;
  title: string;
  status: "in_progress" | "completed" | "pending" | "blocked";
  priority: "high" | "medium" | "low";
  agent: { id?: string; emoji: string; name: string; color: string };
  project: string;
  dueDate: string;
  assigneeAgentId?: string;
  reviewerAgentId?: string;
}

export const taskStatusConfig: Record<string, { label: string; color: string }> = {
  in_progress: { label: "In Progress", color: "#0A84FF" },
  completed: { label: "Completed", color: "#32D74B" },
  pending: { label: "Pending", color: "#FFD60A" },
  blocked: { label: "Blocked", color: "#FF453A" },
};

export const taskPriorityConfig: Record<string, { label: string; color: string }> = {
  high: { label: "High", color: "#FF453A" },
  medium: { label: "Medium", color: "#FF9F0A" },
  low: { label: "Low", color: "#0A84FF" },
};

export const tasks: Task[] = [
  {
    id: "task-001",
    title: "Set up agent health monitoring endpoints",
    status: "in_progress",
    priority: "high",
    agent: { emoji: "🔧", name: "Charlie", color: "#30D158" },
    project: "Agent Org Infrastructure",
    dueDate: "2026-03-10",
  },
  {
    id: "task-002",
    title: "Design inter-agent message bus protocol",
    status: "in_progress",
    priority: "high",
    agent: { emoji: "🔧", name: "Charlie", color: "#30D158" },
    project: "Agent Org Infrastructure",
    dueDate: "2026-03-12",
  },
  {
    id: "task-003",
    title: "Build Projects page UI with mock data",
    status: "completed",
    priority: "high",
    agent: { emoji: "💻", name: "Codex", color: "#FF453A" },
    project: "Mission Control",
    dueDate: "2026-03-07",
  },
  {
    id: "task-004",
    title: "Implement RAG pipeline for course content",
    status: "in_progress",
    priority: "high",
    agent: { emoji: "💻", name: "Codex", color: "#FF453A" },
    project: "Skool AI Extension",
    dueDate: "2026-03-15",
  },
  {
    id: "task-005",
    title: "Research competitor SaaS products in niche",
    status: "in_progress",
    priority: "medium",
    agent: { emoji: "🔮", name: "Violet", color: "#BF5AF2" },
    project: "Micro-SaaS Factory",
    dueDate: "2026-03-14",
  },
  {
    id: "task-006",
    title: "Write weekly trend report for YouTube niche",
    status: "completed",
    priority: "medium",
    agent: { emoji: "🔍", name: "Scout", color: "#FF9F0A" },
    project: "Agent Org Infrastructure",
    dueDate: "2026-03-05",
  },
  {
    id: "task-007",
    title: "Draft blog post on autonomous AI teams",
    status: "pending",
    priority: "medium",
    agent: { emoji: "✍️", name: "Quill", color: "#5E5CE6" },
    project: "Agent Org Infrastructure",
    dueDate: "2026-03-18",
  },
  {
    id: "task-008",
    title: "Create thumbnail templates for new series",
    status: "pending",
    priority: "low",
    agent: { emoji: "🎨", name: "Pixel", color: "#FF375F" },
    project: "Agent Org Infrastructure",
    dueDate: "2026-03-20",
  },
  {
    id: "task-009",
    title: "Schedule social media posts for launch week",
    status: "pending",
    priority: "medium",
    agent: { emoji: "📢", name: "Echo", color: "#64D2FF" },
    project: "Skool AI Extension",
    dueDate: "2026-03-16",
  },
  {
    id: "task-010",
    title: "QA review of Mission Control dashboard",
    status: "blocked",
    priority: "high",
    agent: { emoji: "📋", name: "Ralph", color: "#BF5AF2" },
    project: "Mission Control",
    dueDate: "2026-03-08",
  },
  {
    id: "task-011",
    title: "Set up BLE communication protocol for G2",
    status: "pending",
    priority: "low",
    agent: { emoji: "👤", name: "Unassigned", color: "#8E8E93" },
    project: "Even G2 Integration",
    dueDate: "2026-03-25",
  },
  {
    id: "task-012",
    title: "Coordinate weekly team standup agenda",
    status: "completed",
    priority: "low",
    agent: { emoji: "👔", name: "Henry", color: "#FFD700" },
    project: "Agent Org Infrastructure",
    dueDate: "2026-03-06",
  },
];