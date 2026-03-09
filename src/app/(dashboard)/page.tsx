import { ActivityFeed } from "@/components/ActivityFeed";
import { WeatherWidget } from "@/components/WeatherWidget";
import { BRANDING } from "@/config/branding";
import { Notepad } from "@/components/Notepad";
import { getActivityStats, getActivities } from "@/lib/activities-db";
import { getAgentsSummary } from "@/lib/agents-data";
import {
  Activity,
  CheckCircle,
  XCircle,
  Calendar,
  Bot,
  MessageSquare,
  Users,
  Gamepad2,
  Brain,
  Puzzle,
  Zap,
  Server,
  Terminal,
} from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

function formatLastActivity(timestamp?: string): string {
  if (!timestamp) return "No recent activity";

  const date = new Date(timestamp);
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60_000) return "Active just now";

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `Active ${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Active ${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `Active ${days}d ago`;
}

export default async function DashboardPage() {
  const [activityStats, agents, recentActivities] = await Promise.all([
    Promise.resolve(getActivityStats()),
    getAgentsSummary(),
    Promise.resolve(getActivities({ limit: 5, sort: "newest" }).activities),
  ]);

  const stats = {
    total: activityStats.total || 0,
    today: activityStats.today || 0,
    success: activityStats.byStatus?.success || 0,
    error: activityStats.byStatus?.error || 0,
  };

  const onlineAgents = agents.filter((agent) => agent.status === "online").length;
  const activeSessions = agents.reduce((sum, agent) => sum + agent.activeSessions, 0);
  const weatherConfigured = Boolean(
    process.env.WEATHER_CITY &&
      process.env.WEATHER_LAT &&
      process.env.WEATHER_LON &&
      process.env.WEATHER_TIMEZONE
  );

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="mb-4 md:mb-6">
        <h1
          className="text-2xl md:text-3xl font-bold mb-1"
          style={{
            fontFamily: "var(--font-heading)",
            color: "var(--text-primary)",
            letterSpacing: "-1.5px",
          }}
        >
          🦞 Mission Control
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
          Overview of {BRANDING.agentName} agent activity
        </p>
      </div>

      {/* Runtime Summary */}
      <div
        className="mb-4 md:mb-6 rounded-xl p-4 md:p-5"
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--border)",
        }}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div
              className="text-xs uppercase mb-1"
              style={{ color: "var(--text-muted)", letterSpacing: "0.08em", fontWeight: 700 }}
            >
              Runtime summary
            </div>
            <div className="text-sm md:text-base" style={{ color: "var(--text-secondary)" }}>
              Start here: agent availability, current workload, and whether the system has done anything recently.
            </div>
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            <div
              className="px-3 py-2 rounded-lg"
              style={{
                backgroundColor: onlineAgents > 0 ? "var(--success-bg)" : "var(--card-elevated)",
                color: onlineAgents > 0 ? "var(--success)" : "var(--text-secondary)",
              }}
            >
              <div className="text-[11px] uppercase" style={{ letterSpacing: "0.08em", fontWeight: 700 }}>
                Agents online
              </div>
              <div className="text-lg font-bold">{onlineAgents}/{agents.length}</div>
            </div>
            <div
              className="px-3 py-2 rounded-lg"
              style={{
                backgroundColor:
                  activeSessions > 0
                    ? "color-mix(in srgb, var(--accent) 12%, transparent)"
                    : "var(--card-elevated)",
                color: "var(--text-secondary)",
              }}
            >
              <div className="text-[11px] uppercase" style={{ letterSpacing: "0.08em", fontWeight: 700 }}>
                Active sessions
              </div>
              <div className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                {activeSessions}
              </div>
            </div>
            <div
              className="px-3 py-2 rounded-lg"
              style={{
                backgroundColor: stats.today > 0 ? "var(--success-bg)" : "var(--warning-bg)",
                color: stats.today > 0 ? "var(--success)" : "var(--warning)",
              }}
            >
              <div className="text-[11px] uppercase" style={{ letterSpacing: "0.08em", fontWeight: 700 }}>
                Recent activity
              </div>
              <div className="text-sm font-semibold">
                {stats.today > 0 ? `${stats.today} today` : "None today"}
              </div>
            </div>
            <div
              className="px-3 py-2 rounded-lg"
              style={{
                backgroundColor: weatherConfigured
                  ? "var(--card-elevated)"
                  : "color-mix(in srgb, var(--warning) 10%, transparent)",
                color: weatherConfigured ? "var(--text-secondary)" : "var(--warning)",
              }}
            >
              <div className="text-[11px] uppercase" style={{ letterSpacing: "0.08em", fontWeight: 700 }}>
                Weather
              </div>
              <div className="text-sm font-semibold">
                {weatherConfigured ? "Configured" : "Optional / unavailable"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Multi-Agent Status */}
      <div
        className="mb-6 rounded-xl overflow-hidden"
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--border)",
        }}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-3">
            <div className="accent-line" />
            <h2
              className="text-base font-semibold"
              style={{
                fontFamily: "var(--font-heading)",
                color: "var(--text-primary)",
              }}
            >
              <Users className="inline-block w-5 h-5 mr-2 mb-1" />
              Multi-Agent System
            </h2>
          </div>
          <div className="flex gap-2">
            <Link
              href="/office"
              className="text-sm font-medium px-3 py-1.5 rounded-lg transition-all"
              style={{
                backgroundColor: "var(--accent)",
                color: "var(--text-primary)",
              }}
            >
              <Gamepad2 className="inline-block w-4 h-4 mr-1 mb-0.5" />
              Open Office
            </Link>
            <Link href="/agents" className="text-sm font-medium" style={{ color: "var(--accent)" }}>
              View all →
            </Link>
          </div>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {agents.map((agent) => {
              const isOnline = agent.status === "online";
              return (
                <div
                  key={agent.id}
                  className="p-3 rounded-lg transition-all hover:scale-105"
                  style={{
                    backgroundColor: "var(--card-elevated)",
                    border: `2px solid ${agent.color}`,
                    cursor: "pointer",
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-2xl">{agent.emoji}</div>
                    <div
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: isOnline
                          ? "color-mix(in srgb, var(--success) 12%, transparent)"
                          : "var(--card)",
                        color: isOnline ? "var(--success)" : "var(--text-muted)",
                        border: `1px solid ${isOnline ? 'var(--success)' : 'var(--border)'}`,
                      }}
                    >
                      {isOnline ? "Online" : "Offline"}
                    </div>
                  </div>
                  <div
                    className="text-sm font-bold mb-1"
                    style={{
                      fontFamily: "var(--font-heading)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {agent.name}
                  </div>
                  <div className="text-xs mb-2" style={{ color: "var(--text-secondary)" }}>
                    {agent.activeSessions > 0
                      ? `${agent.activeSessions} active session${agent.activeSessions > 1 ? 's' : ''}`
                      : formatLastActivity(agent.lastActivity)}
                  </div>
                  <div className="text-xs truncate mb-1" style={{ color: "var(--text-muted)" }} title={agent.model}>
                    <Bot className="inline-block w-3 h-3 mr-1" />
                    {agent.model.split("/").pop()}
                  </div>
                  {agent.botToken && (
                    <div className="text-xs mt-1 flex items-center gap-1" style={{ color: "#0088cc" }}>
                      <MessageSquare className="w-3 h-3" />
                      Connected
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Activity Feed */}
        <div
          className="lg:col-span-2 rounded-xl overflow-hidden"
          style={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
          }}
        >
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-3">
              <div className="accent-line" />
              <h2
                className="text-base font-semibold"
                style={{
                  fontFamily: "var(--font-heading)",
                  color: "var(--text-primary)",
                }}
              >
                Recent Activity
              </h2>
            </div>
            <a href="/activity" className="text-sm font-medium" style={{ color: "var(--accent)" }}>
              View all →
            </a>
          </div>
          <div className="p-0">
            <ActivityFeed
              limit={5}
              initialActivities={recentActivities}
              hasRecentActivity={stats.today > 0}
              compactEmptyState
            />
          </div>
        </div>

        {/* Secondary Sidebar */}
        <div className="flex flex-col gap-4">
          {/* Activity Counters */}
          <div
            className="rounded-xl overflow-hidden"
            style={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
            }}
          >
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-3">
                <div className="accent-line" />
                <h2
                  className="text-base font-semibold"
                  style={{
                    fontFamily: "var(--font-heading)",
                    color: "var(--text-primary)",
                  }}
                >
                  Activity Counters
                </h2>
              </div>
            </div>
            <div className="p-4 space-y-2">
              {[
                {
                  label: "Total activities",
                  value: stats.total.toLocaleString(),
                  icon: Activity,
                  color: "var(--info)",
                },
                {
                  label: "Successful runs",
                  value: stats.success.toLocaleString(),
                  icon: CheckCircle,
                  color: "var(--success)",
                },
                {
                  label: "Errors logged",
                  value: stats.error.toLocaleString(),
                  icon: XCircle,
                  color: "var(--error)",
                },
              ].map(({ label, value, icon: Icon, color }) => (
                <div
                  key={label}
                  className="flex items-center justify-between rounded-lg px-3 py-2"
                  style={{ backgroundColor: "var(--card-elevated)" }}
                >
                  <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                    <Icon className="w-4 h-4" style={{ color }} />
                    <span>{label}</span>
                  </div>
                  <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    {value}
                  </div>
                </div>
              ))}
              <div className="pt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                Historical counters are useful for trend reading, but the runtime summary above is the primary health signal.
              </div>
            </div>
          </div>

          {/* Weather Widget */}
          <WeatherWidget />

          {/* Quick Links */}
          <div
            className="rounded-xl overflow-hidden"
            style={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
            }}
          >
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-3">
                <div className="accent-line" />
                <h2
                  className="text-base font-semibold"
                  style={{
                    fontFamily: "var(--font-heading)",
                    color: "var(--text-primary)",
                  }}
                >
                  Quick Links
                </h2>
              </div>
            </div>
            <div className="p-4 grid grid-cols-2 gap-2">
              {[
                { href: "/cron", icon: Calendar, label: "Cron Jobs", color: "#a78bfa" },
                { href: "/actions", icon: Zap, label: "Quick Actions", color: "var(--accent)" },
                { href: "/system", icon: Server, label: "System", color: "var(--success)" },
                { href: "/logs", icon: Terminal, label: "Live Logs", color: "#60a5fa" },
                { href: "/memory", icon: Brain, label: "Memory", color: "#f59e0b" },
                { href: "/skills", icon: Puzzle, label: "Skills", color: "#4ade80" },
              ].map(({ href, icon: Icon, label, color }) => (
                <Link
                  key={href}
                  href={href}
                  className="p-3 rounded-lg transition-all hover:scale-[1.02]"
                  style={{ backgroundColor: "var(--card-elevated)", border: "1px solid var(--border)" }}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4" style={{ color }} />
                    <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                      {label}
                    </span>
                  </div>
                </Link>
              ))}
            </div>

            <div style={{ margin: "1rem", marginTop: "0.5rem" }}>
              <Notepad />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
