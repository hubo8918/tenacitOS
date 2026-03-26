export type ProjectPhaseExecutionMode = "manual" | "agent-run";
export type ProjectPhaseRunStatus = "idle" | "queued" | "running" | "needs_review" | "done" | "failed";
export type ProjectPhaseRunKind = "manual" | "agent_packet";
export type ProjectPhaseRunIntent = "start" | "review" | "debug" | "agent_check_in" | "agent_wake";

export interface ProjectPhaseRunFields {
  status?: string;
  focus?: string;
  next?: string;
  blockers?: string;
  needsFromHuman?: string;
  decision?: string;
  handoffTo?: string;
  reviewerAgentId?: string;
  reviewerName?: string;
}

export interface ProjectPhaseLatestRun {
  id: string;
  kind: ProjectPhaseRunKind;
  intent: ProjectPhaseRunIntent;
  action?: "check-in" | "wake" | "review";
  timestamp: string;
  runStatus?: ProjectPhaseRunStatus;
  executionMode?: ProjectPhaseExecutionMode;
  deliverable?: string;
  text?: string;
  agentId?: string;
  agentName?: string;
  model?: string;
  sessionId?: string;
  runId?: string;
  thinking?: string;
  fields?: ProjectPhaseRunFields | null;
}

export interface ProjectPhase {
  id: string;
  title: string;
  status: "pending" | "in_progress" | "blocked" | "completed";
  ownerAgentId?: string;
  reviewerAgentId?: string;
  handoffToAgentId?: string;
  dependsOnPhaseIds: string[];
  latestRun?: ProjectPhaseLatestRun | null;
}

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
  ownerAgentId?: string;
  participatingAgentIds: string[];
  phases: ProjectPhase[];
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
    description:
      "Core infrastructure for the autonomous agent organization. Health monitoring, message bus, shared memory, and inter-agent communication protocols.",
    status: "active",
    progress: 62,
    priority: "high",
    agent: { emoji: "🔧", name: "Charlie", color: "#30D158" },
    updatedAgo: "4 days ago",
    updatedBy: "Henry",
    ownerAgentId: "charlie",
    participatingAgentIds: ["charlie", "henry", "scout"],
    phases: [],
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
    ownerAgentId: "henry",
    participatingAgentIds: ["henry", "codex", "pixel", "ralph"],
    phases: [],
  },
  {
    id: "skool-ai-extension",
    title: "Skool AI Extension",
    description: '"Ask Alex" Chrome extension for Vibely Academy. RAG pipeline over course content with personalized responses.',
    status: "active",
    progress: 25,
    priority: "high",
    agent: { emoji: "👔", name: "Henry", color: "#FFD700" },
    updatedAgo: "4 days ago",
    updatedBy: "Henry",
    ownerAgentId: "henry",
    participatingAgentIds: ["henry", "codex", "echo"],
    phases: [],
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
    ownerAgentId: "violet",
    participatingAgentIds: ["violet", "scout"],
    phases: [],
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
    ownerAgentId: undefined,
    participatingAgentIds: [],
    phases: [],
  },
];
