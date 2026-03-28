export interface Task {
  id: string;
  title: string;
  status: "in_progress" | "completed" | "pending" | "blocked";
  priority: "high" | "medium" | "low";
  agent: { id?: string; emoji: string; name: string; color: string };
  project: string;
  projectId?: string;
  dueDate: string;
  assigneeAgentId?: string;
  reviewerAgentId?: string;
  handoffToAgentId?: string;
  blockedByTaskIds?: string[];
  runStatus?: "idle" | "queued" | "running" | "needs_review" | "done" | "failed";
  executionMode?: "manual" | "agent-run";
  deliverable?: string;
  latestRun?: {
    id: string;
    kind: "manual" | "agent_packet";
    intent: "start" | "review" | "debug" | "agent_check_in" | "agent_wake";
    action?: "check-in" | "wake" | "review";
    timestamp: string;
    runStatus?: "idle" | "queued" | "running" | "needs_review" | "done" | "failed";
    executionMode?: "manual" | "agent-run";
    deliverable?: string;
    text?: string;
    agentId?: string;
    agentName?: string;
    model?: string;
    sessionId?: string;
    runId?: string;
    thinking?: string;
    fields?: {
      status?: string;
      focus?: string;
      next?: string;
      blockers?: string;
      needsFromHuman?: string;
      decision?: string;
      handoffTo?: string;
    } | null;
  } | null;
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
    agent: { id: "charlie", emoji: "\u{1F527}", name: "Charlie", color: "#30D158" },
    project: "Agent Org Infrastructure",
    projectId: "agent-org-infra",
    dueDate: "2026-03-10",
    assigneeAgentId: "charlie",
    reviewerAgentId: "henry",
    blockedByTaskIds: [],
    executionMode: "manual",
    runStatus: "idle",
    deliverable: "",
  },
  {
    id: "task-002",
    title: "Design inter-agent message bus protocol",
    status: "in_progress",
    priority: "high",
    agent: { id: "charlie", emoji: "\u{1F527}", name: "Charlie", color: "#30D158" },
    project: "Agent Org Infrastructure",
    projectId: "agent-org-infra",
    dueDate: "2026-03-12",
    assigneeAgentId: "charlie",
    reviewerAgentId: "henry",
    blockedByTaskIds: [],
    executionMode: "manual",
    runStatus: "idle",
    deliverable: "",
  },
  {
    id: "task-003",
    title: "Build Projects page UI with mock data",
    status: "completed",
    priority: "high",
    agent: { id: "codex", emoji: "\u{1F4BB}", name: "Codex", color: "#FF453A" },
    project: "Mission Control",
    projectId: "mission-control",
    dueDate: "2026-03-07",
    assigneeAgentId: "codex",
    reviewerAgentId: "henry",
    handoffToAgentId: "ralph",
    blockedByTaskIds: [],
    executionMode: "agent-run",
    runStatus: "needs_review",
    deliverable: "Projects page summary cards and inspector split are ready for review.",
    latestRun: {
      id: "task-003-checkin",
      kind: "agent_packet",
      intent: "agent_check_in",
      action: "check-in",
      timestamp: "2026-03-25T15:30:00.000Z",
      runStatus: "needs_review",
      executionMode: "agent-run",
      deliverable: "Projects page summary cards and inspector split are ready for review.",
      text: "Waiting on Henry review before QA handoff.",
      agentId: "codex",
      agentName: "Codex",
      model: "openai-codex/gpt-5.4",
      thinking: "high",
      fields: {
        status: "needs_review",
        focus: "Projects planning surface",
        next: "Approve or return with layout fixes.",
        blockers: "Need reviewer sign-off.",
        needsFromHuman: "Henry review decision",
      },
    },
  },
  {
    id: "task-004",
    title: "Implement RAG pipeline for course content",
    status: "in_progress",
    priority: "high",
    agent: { id: "codex", emoji: "\u{1F4BB}", name: "Codex", color: "#FF453A" },
    project: "Skool AI Extension",
    projectId: "skool-ai-extension",
    dueDate: "2026-03-15",
    assigneeAgentId: "codex",
    reviewerAgentId: "henry",
    blockedByTaskIds: [],
    executionMode: "manual",
    runStatus: "idle",
    deliverable: "",
  },
  {
    id: "task-005",
    title: "Research competitor SaaS products in niche",
    status: "in_progress",
    priority: "medium",
    agent: { id: "violet", emoji: "\u{1F52E}", name: "Violet", color: "#BF5AF2" },
    project: "Micro-SaaS Factory",
    projectId: "micro-saas-factory",
    dueDate: "2026-03-14",
    assigneeAgentId: "violet",
    reviewerAgentId: "henry",
    blockedByTaskIds: [],
    executionMode: "manual",
    runStatus: "idle",
    deliverable: "",
  },
  {
    id: "task-006",
    title: "Write weekly trend report for YouTube niche",
    status: "completed",
    priority: "medium",
    agent: { id: "scout", emoji: "\u{1F50D}", name: "Scout", color: "#FF9F0A" },
    project: "Agent Org Infrastructure",
    projectId: "agent-org-infra",
    dueDate: "2026-03-05",
    assigneeAgentId: "scout",
    reviewerAgentId: "henry",
    blockedByTaskIds: [],
    executionMode: "manual",
    runStatus: "done",
    deliverable: "",
  },
  {
    id: "task-007",
    title: "Draft blog post on autonomous AI teams",
    status: "pending",
    priority: "medium",
    agent: { id: "quill", emoji: "\u270D\uFE0F", name: "Quill", color: "#5E5CE6" },
    project: "Agent Org Infrastructure",
    projectId: "agent-org-infra",
    dueDate: "2026-03-18",
    assigneeAgentId: "quill",
    reviewerAgentId: "henry",
    blockedByTaskIds: [],
    executionMode: "manual",
    runStatus: "idle",
    deliverable: "",
  },
  {
    id: "task-008",
    title: "Create thumbnail templates for new series",
    status: "pending",
    priority: "low",
    agent: { id: "pixel", emoji: "\u{1F3A8}", name: "Pixel", color: "#FF375F" },
    project: "Agent Org Infrastructure",
    projectId: "agent-org-infra",
    dueDate: "2026-03-20",
    assigneeAgentId: "pixel",
    reviewerAgentId: "henry",
    blockedByTaskIds: [],
    executionMode: "manual",
    runStatus: "idle",
    deliverable: "",
  },
  {
    id: "task-009",
    title: "Schedule social media posts for launch week",
    status: "pending",
    priority: "medium",
    agent: { id: "echo", emoji: "\u{1F4E2}", name: "Echo", color: "#64D2FF" },
    project: "Skool AI Extension",
    projectId: "skool-ai-extension",
    dueDate: "2026-03-16",
    assigneeAgentId: "echo",
    reviewerAgentId: "henry",
    blockedByTaskIds: [],
    executionMode: "manual",
    runStatus: "idle",
    deliverable: "",
  },
  {
    id: "task-010",
    title: "QA review of Mission Control dashboard",
    status: "blocked",
    priority: "high",
    agent: { id: "ralph", emoji: "\u{1F4CB}", name: "Ralph", color: "#BF5AF2" },
    project: "Mission Control",
    projectId: "mission-control",
    dueDate: "2026-03-08",
    assigneeAgentId: "ralph",
    reviewerAgentId: "henry",
    blockedByTaskIds: [],
    executionMode: "manual",
    runStatus: "failed",
    deliverable: "",
  },
  {
    id: "task-011",
    title: "Set up BLE communication protocol for G2",
    status: "pending",
    priority: "low",
    agent: { emoji: "\u{1F464}", name: "Unassigned", color: "#8E8E93" },
    project: "Even G2 Integration",
    projectId: "even-g2-integration",
    dueDate: "2026-03-25",
    blockedByTaskIds: [],
    executionMode: "manual",
    runStatus: "idle",
    deliverable: "",
  },
  {
    id: "task-012",
    title: "Coordinate weekly team standup agenda",
    status: "completed",
    priority: "low",
    agent: { id: "henry", emoji: "\u{1F454}", name: "Henry", color: "#FFD700" },
    project: "Agent Org Infrastructure",
    projectId: "agent-org-infra",
    dueDate: "2026-03-06",
    assigneeAgentId: "henry",
    reviewerAgentId: "ralph",
    blockedByTaskIds: [],
    executionMode: "manual",
    runStatus: "done",
    deliverable: "",
  },
  {
    id: "task-013",
    title: "Final dashboard polish and accessibility",
    status: "pending",
    priority: "high",
    agent: { id: "pixel", emoji: "\u2728", name: "Pixel", color: "#FF375F" },
    project: "Mission Control",
    projectId: "mission-control",
    dueDate: "2026-03-14",
    assigneeAgentId: "pixel",
    reviewerAgentId: "henry",
    blockedByTaskIds: ["task-010"],
    executionMode: "manual",
    runStatus: "idle",
    deliverable: "",
  },
];
