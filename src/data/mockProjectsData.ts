export interface Project {
  id: string;
  title: string;
  description: string;
  status: "active" | "planning" | "paused" | "completed";
  progress: number;
  priority: "high" | "medium" | "low";
  agent: { emoji: string; name: string; color: string };
  updatedAgo: string;
  updatedBy: string;
}

export const statusConfig: Record<string, { label: string; color: string }> = {
  active: { label: "Active", color: "#32D74B" },
  planning: { label: "Planning", color: "#0A84FF" },
  paused: { label: "Paused", color: "#FFD60A" },
  completed: { label: "Completed", color: "#8E8E93" },
};

export const priorityConfig: Record<string, { label: string; color: string }> = {
  high: { label: "high", color: "#FF453A" },
  medium: { label: "medium", color: "#FF9F0A" },
  low: { label: "low", color: "#0A84FF" },
};

export const projects: Project[] = [
  {
    id: "agent-org-infra",
    title: "Agent Org Infrastructure",
    description: "Core infrastructure for the autonomous agent organization. Health monitoring, message bus, shared memory, and inter-agent communication protocols.",
    status: "active",
    progress: 62,
    priority: "high",
    agent: { emoji: "🔧", name: "Charlie", color: "#30D158" },
    updatedAgo: "4 days ago",
    updatedBy: "Henry",
  },
  {
    id: "mission-control",
    title: "Mission Control",
    description: "Central dashboard for the agent organization. Tasks, projects, approvals, agent activity, docs, and real-time monitoring.",
    status: "active",
    progress: 71,
    priority: "high",
    agent: { emoji: "👔", name: "Henry", color: "#FFD700" },
    updatedAgo: "8 days ago",
    updatedBy: "Henry",
  },
  {
    id: "skool-ai-extension",
    title: "Skool AI Extension",
    description: "\"Ask Alex\" Chrome extension for Vibely Academy. RAG pipeline over course content with personalized responses.",
    status: "active",
    progress: 25,
    priority: "high",
    agent: { emoji: "👔", name: "Henry", color: "#FFD700" },
    updatedAgo: "4 days ago",
    updatedBy: "Henry",
  },
  {
    id: "micro-saas-factory",
    title: "Micro-SaaS Factory",
    description: "Violet's opportunity engine — research market gaps, validate ideas, and build small SaaS products autonomously.",
    status: "planning",
    progress: 15,
    priority: "medium",
    agent: { emoji: "🔮", name: "Violet", color: "#BF5AF2" },
    updatedAgo: "8 days ago",
    updatedBy: "Violet",
  },
  {
    id: "even-g2-integration",
    title: "Even G2 Integration",
    description: "Smart glasses bridge app connecting Even Realities G2 glasses to Henry via BLE. AI assistant in your glasses.",
    status: "planning",
    progress: 0,
    priority: "medium",
    agent: { emoji: "👤", name: "Unassigned", color: "#8E8E93" },
    updatedAgo: "4 days ago",
    updatedBy: "",
  },
];
