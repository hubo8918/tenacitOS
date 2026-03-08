"use client";

import { useEffect } from "react";
import { AgentCard } from "@/components/AgentCard";
import { TierDivider } from "@/components/TierDivider";
import { tierConfig } from "@/data/mockTeamData";
import { useFetch } from "@/lib/useFetch";
import type { TeamAgent } from "@/data/mockTeamData";

export default function TeamPage() {
  const { data, loading, error, refetch } = useFetch<{ team: TeamAgent[] }>("/api/team");
  const teamAgents = data?.team || [];

  useEffect(() => {
    const timer = setInterval(() => {
      refetch();
    }, 20_000);

    return () => clearInterval(timer);
  }, [refetch]);

  if (loading) {
    return (
      <div className="p-4 md:p-8 flex items-center justify-center min-h-[400px]">
        <div className="text-sm" style={{ color: "var(--text-muted)" }}>Loading team...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-8 flex items-center justify-center min-h-[400px]">
        <div className="text-sm" style={{ color: "var(--negative, #FF453A)" }}>Failed to load team: {error}</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      {/* Hero Quote Banner */}
      <div
        className="rounded-xl p-6 md:p-8 mb-8 md:mb-12 text-center"
        style={{
          backgroundColor: "var(--surface-elevated)",
          border: "1px solid var(--border)",
          backgroundImage: "linear-gradient(135deg, rgba(255, 59, 48, 0.05), rgba(191, 90, 242, 0.05))",
        }}
      >
        <p
          className="text-sm md:text-base italic"
          style={{
            color: "var(--text-secondary)",
            fontFamily: "var(--font-body)",
            lineHeight: 1.6,
          }}
        >
          &ldquo;An autonomous organization of AI agents that does work for me and produces value 24/7&rdquo;
        </p>
      </div>

      {/* Title Section */}
      <div className="text-center mb-10 md:mb-16">
        <h1
          className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4"
          style={{
            fontFamily: "var(--font-heading)",
            color: "var(--text-primary)",
            letterSpacing: "-1.5px",
          }}
        >
          Meet the Team
        </h1>
        <p
          className="text-base md:text-lg mb-4"
          style={{
            color: "var(--text-secondary)",
            fontFamily: "var(--font-heading)",
            fontWeight: 500,
          }}
        >
          9 AI agents across 3 machines, each with a real role and a real personality.
        </p>
        <p
          className="text-sm max-w-2xl mx-auto"
          style={{
            color: "var(--text-muted)",
            lineHeight: 1.7,
          }}
        >
          We wanted to see what happens when AI doesn&apos;t just answer questions — but actually runs a
          company. Research markets. Write content. Post on social media. Ship products. All without being
          told what to do.
        </p>
        <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
          Live sync enabled · Team status refreshes every 20s
        </p>
      </div>

      {/* Tier Sections */}
      {tierConfig.map((tier) => {
        const agents = teamAgents.filter((a) => a.tier === tier.id);
        if (agents.length === 0) return null;

        return (
          <div key={tier.id}>
            {/* Divider (skip for first tier) */}
            {tier.label && <TierDivider label={tier.label} />}

            {/* Cards Grid */}
            <div
              className={`grid ${tier.gridCols} gap-4 md:gap-6 mx-auto ${tier.maxWidth || ""}`}
            >
              {agents.map((agent) => (
                <AgentCard key={agent.id} agent={agent} onUpdate={refetch} />
              ))}
            </div>
          </div>
        );
      })}

      {/* Bottom spacing */}
      <div className="h-12" />
    </div>
  );
}
