export interface DocFolder {
  id: string;
  name: string;
  emoji: string;
  agent?: { name: string; emoji: string; color: string };
  fileCount: number;
}

export interface DocFile {
  id: string;
  name: string;
  type: "markdown" | "config" | "script" | "log" | "image";
  size: string;
  modifiedAt: string;
  modifiedBy: { name: string; emoji: string; color: string };
  folderId: string;
}

export const fileTypeConfig: Record<DocFile["type"], { icon: string; label: string; color: string }> = {
  markdown: { icon: "📄", label: "Markdown", color: "#0A84FF" },
  config: { icon: "⚙️", label: "Config", color: "#FF9F0A" },
  script: { icon: "📜", label: "Script", color: "#32D74B" },
  log: { icon: "📋", label: "Log", color: "#8E8E93" },
  image: { icon: "🖼️", label: "Image", color: "#BF5AF2" },
};

export const folders: DocFolder[] = [
  { id: "general", name: "General", emoji: "📁", fileCount: 4 },
  { id: "henry", name: "Henry's Notes", emoji: "👔", agent: { name: "Henry", emoji: "👔", color: "#FFD700" }, fileCount: 3 },
  { id: "infra", name: "Infrastructure", emoji: "🔧", agent: { name: "Charlie", emoji: "🔧", color: "#30D158" }, fileCount: 5 },
  { id: "content", name: "Content", emoji: "✍️", agent: { name: "Quill", emoji: "✍️", color: "#5E5CE6" }, fileCount: 3 },
  { id: "research", name: "Research", emoji: "🔮", agent: { name: "Violet", emoji: "🔮", color: "#BF5AF2" }, fileCount: 4 },
  { id: "designs", name: "Designs", emoji: "🎨", agent: { name: "Pixel", emoji: "🎨", color: "#FF375F" }, fileCount: 2 },
];

export const files: DocFile[] = [
  // General
  { id: "g1", name: "README.md", type: "markdown", size: "4.2 KB", modifiedAt: "2026-03-15", modifiedBy: { name: "Henry", emoji: "👔", color: "#FFD700" }, folderId: "general" },
  { id: "g2", name: "team-charter.md", type: "markdown", size: "8.1 KB", modifiedAt: "2026-03-10", modifiedBy: { name: "Henry", emoji: "👔", color: "#FFD700" }, folderId: "general" },
  { id: "g3", name: "onboarding-guide.md", type: "markdown", size: "6.3 KB", modifiedAt: "2026-03-08", modifiedBy: { name: "Ralph", emoji: "📋", color: "#FF9F0A" }, folderId: "general" },
  { id: "g4", name: "env.config", type: "config", size: "1.1 KB", modifiedAt: "2026-03-14", modifiedBy: { name: "Charlie", emoji: "🔧", color: "#30D158" }, folderId: "general" },
  // Henry's Notes
  { id: "h1", name: "daily-standup-notes.md", type: "markdown", size: "12.4 KB", modifiedAt: "2026-03-16", modifiedBy: { name: "Henry", emoji: "👔", color: "#FFD700" }, folderId: "henry" },
  { id: "h2", name: "delegation-log.md", type: "markdown", size: "5.7 KB", modifiedAt: "2026-03-15", modifiedBy: { name: "Henry", emoji: "👔", color: "#FFD700" }, folderId: "henry" },
  { id: "h3", name: "weekly-report.md", type: "markdown", size: "9.2 KB", modifiedAt: "2026-03-12", modifiedBy: { name: "Henry", emoji: "👔", color: "#FFD700" }, folderId: "henry" },
  // Infrastructure
  { id: "i1", name: "server-setup.sh", type: "script", size: "3.4 KB", modifiedAt: "2026-03-16", modifiedBy: { name: "Charlie", emoji: "🔧", color: "#30D158" }, folderId: "infra" },
  { id: "i2", name: "docker-compose.config", type: "config", size: "2.8 KB", modifiedAt: "2026-03-15", modifiedBy: { name: "Charlie", emoji: "🔧", color: "#30D158" }, folderId: "infra" },
  { id: "i3", name: "deploy-notes.md", type: "markdown", size: "5.1 KB", modifiedAt: "2026-03-14", modifiedBy: { name: "Charlie", emoji: "🔧", color: "#30D158" }, folderId: "infra" },
  { id: "i4", name: "monitoring.config", type: "config", size: "1.9 KB", modifiedAt: "2026-03-13", modifiedBy: { name: "Charlie", emoji: "🔧", color: "#30D158" }, folderId: "infra" },
  { id: "i5", name: "deploy-2026-03-12.log", type: "log", size: "24.6 KB", modifiedAt: "2026-03-12", modifiedBy: { name: "Charlie", emoji: "🔧", color: "#30D158" }, folderId: "infra" },
  // Content
  { id: "c1", name: "content-calendar.md", type: "markdown", size: "7.3 KB", modifiedAt: "2026-03-16", modifiedBy: { name: "Quill", emoji: "✍️", color: "#5E5CE6" }, folderId: "content" },
  { id: "c2", name: "style-guide.md", type: "markdown", size: "11.2 KB", modifiedAt: "2026-03-11", modifiedBy: { name: "Quill", emoji: "✍️", color: "#5E5CE6" }, folderId: "content" },
  { id: "c3", name: "publish-script.sh", type: "script", size: "1.8 KB", modifiedAt: "2026-03-09", modifiedBy: { name: "Quill", emoji: "✍️", color: "#5E5CE6" }, folderId: "content" },
  // Research
  { id: "r1", name: "market-analysis-q1.md", type: "markdown", size: "15.8 KB", modifiedAt: "2026-03-16", modifiedBy: { name: "Violet", emoji: "🔮", color: "#BF5AF2" }, folderId: "research" },
  { id: "r2", name: "competitor-matrix.md", type: "markdown", size: "9.4 KB", modifiedAt: "2026-03-14", modifiedBy: { name: "Violet", emoji: "🔮", color: "#BF5AF2" }, folderId: "research" },
  { id: "r3", name: "trend-report.md", type: "markdown", size: "6.7 KB", modifiedAt: "2026-03-13", modifiedBy: { name: "Scout", emoji: "🔍", color: "#FF6B35" }, folderId: "research" },
  { id: "r4", name: "scrape-results.log", type: "log", size: "42.1 KB", modifiedAt: "2026-03-12", modifiedBy: { name: "Scout", emoji: "🔍", color: "#FF6B35" }, folderId: "research" },
  // Designs
  { id: "d1", name: "thumbnail-template.png", type: "image", size: "256 KB", modifiedAt: "2026-03-15", modifiedBy: { name: "Pixel", emoji: "🎨", color: "#FF375F" }, folderId: "designs" },
  { id: "d2", name: "brand-assets.png", type: "image", size: "1.2 MB", modifiedAt: "2026-03-10", modifiedBy: { name: "Pixel", emoji: "🎨", color: "#FF375F" }, folderId: "designs" },
];
