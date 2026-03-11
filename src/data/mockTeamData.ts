export interface TeamAgent {
  id: string;
  name: string;
  role: string;
  emoji: string;
  color: string;
  description: string;
  tags: Array<{ label: string; color: string }>;
  status: "online" | "offline";
  tier: "leadership" | "operations" | "io" | "meta";
  specialBadge?: string; // e.g. "The Engineer" for Codex
  reportsTo?: string;
  activeSessions?: number;
  lastActiveAt?: string | null;
  model?: string;
  workspace?: string;
  identitySource?: string;
}

export interface TierConfig {
  id: string;
  label: string | null;
  gridCols: string; // tailwind grid class
  maxWidth?: string; // optional max-width constraint
}

export const teamAgents: TeamAgent[] = [
  // Tier 1: Leadership
  {
    id: "henry",
    name: "Henry",
    role: "Chief of Staff",
    emoji: "\u{1F454}",
    color: "#FFD700",
    description: "Coordinates, delegates, keeps the ship tight. The first point of contact between you and everyone.",
    tags: [
      { label: "Communication", color: "#0A84FF" },
      { label: "Quality", color: "#30D158" },
      { label: "Integration", color: "#5E5CE6" },
    ],
    status: "online",
    tier: "leadership",
  },
  // Tier 2: Operations
  {
    id: "charlie",
    name: "Charlie",
    role: "Infrastructure Engineer",
    emoji: "\u{1F527}",
    color: "#30D158",
    description: "Builds and maintains the infrastructure. Keeps servers running, deploys code, and automates everything.",
    tags: [
      { label: "Coding", color: "#30D158" },
      { label: "Infrastructure", color: "#0A84FF" },
      { label: "Automation", color: "#64D2FF" },
    ],
    status: "online",
    tier: "operations",
  },
  {
    id: "ralph",
    name: "Ralph",
    role: "Comms / QA Manager",
    emoji: "\u{1F4CB}",
    color: "#BF5AF2",
    description: "Checks the work, signs off, or sends it back. Quality assurance and monitoring.",
    tags: [
      { label: "Quality Assurance", color: "#BF5AF2" },
      { label: "Monitoring", color: "#FF9F0A" },
      { label: "Demo Recording", color: "#FF375F" },
    ],
    status: "online",
    tier: "operations",
  },
  // Tier 3: Input/Output
  {
    id: "scout",
    name: "Scout",
    role: "Trend Analyst",
    emoji: "\u{1F50D}",
    color: "#FF9F0A",
    description: "Finds trends, tracks signals, and surfaces what matters before anyone else notices.",
    tags: [
      { label: "Speed", color: "#FF9F0A" },
      { label: "Radar", color: "#FF375F" },
      { label: "Analytics", color: "#FFD60A" },
    ],
    status: "online",
    tier: "io",
  },
  {
    id: "quill",
    name: "Quill",
    role: "Content Writer",
    emoji: "\u270D\uFE0F",
    color: "#5E5CE6",
    description: "Writes copy, blog posts, social captions, and anything that needs words.",
    tags: [
      { label: "Docs", color: "#5E5CE6" },
      { label: "Quality", color: "#30D158" },
    ],
    status: "online",
    tier: "io",
  },
  {
    id: "pixel",
    name: "Pixel",
    role: "Thumbnail Designer",
    emoji: "\u{1F3A8}",
    color: "#FF375F",
    description: "Designs thumbnails, social graphics, and visual content that catches eyes.",
    tags: [
      { label: "Design", color: "#FF375F" },
      { label: "Visual", color: "#BF5AF2" },
      { label: "Viral", color: "#FF9F0A" },
    ],
    status: "offline",
    tier: "io",
  },
  {
    id: "echo",
    name: "Echo",
    role: "Social Media Manager",
    emoji: "\u{1F4E2}",
    color: "#64D2FF",
    description: "Posts, schedules, engages. Manages all social media presence across platforms.",
    tags: [
      { label: "Social", color: "#64D2FF" },
      { label: "Growth", color: "#30D158" },
      { label: "Reach", color: "#0A84FF" },
    ],
    status: "online",
    tier: "io",
  },
  // Tier 4: Meta
  {
    id: "codex",
    name: "Codex",
    role: "Lead Engineer",
    emoji: "\u{1F4BB}",
    color: "#FF453A",
    description: "The quiet one who makes everything actually work. Systems architecture and reliability.",
    tags: [
      { label: "Code", color: "#FF453A" },
      { label: "Systems", color: "#FF9F0A" },
      { label: "Reliability", color: "#FFD60A" },
    ],
    status: "online",
    tier: "meta",
    specialBadge: "The Engineer",
  },
  {
    id: "violet",
    name: "Violet",
    role: "Research Analyst",
    emoji: "\u{1F52E}",
    color: "#BF5AF2",
    description: "Deep research and analysis specialist. Finds patterns others miss.",
    tags: [
      { label: "Research", color: "#BF5AF2" },
      { label: "Analysis", color: "#5E5CE6" },
    ],
    status: "online",
    tier: "meta",
  },
];

export const tierConfig: TierConfig[] = [
  { id: "leadership", label: null, gridCols: "grid-cols-1", maxWidth: "max-w-md" },
  { id: "operations", label: "\u26A1 OPERATIONS (Mac Studio 2) \u26A1", gridCols: "grid-cols-1 md:grid-cols-2", maxWidth: "max-w-3xl" },
  { id: "io", label: "\u26A1 INPUT SIGNAL \u2192          OUTPUT ACTION \u2192", gridCols: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" },
  { id: "meta", label: "\u26A1 META LAYER \u26A1", gridCols: "grid-cols-1 md:grid-cols-2", maxWidth: "max-w-3xl" },
];
