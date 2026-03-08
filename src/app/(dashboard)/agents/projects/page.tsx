"use client";

import { FolderKanban } from "lucide-react";
import { ProjectCard } from "@/components/ProjectCard";
import type { Project } from "@/data/mockProjectsData";
import { useFetch } from "@/lib/useFetch";

export default function ProjectsPage() {
  const { data, loading, error, refetch } = useFetch<{ projects: Project[] }>("/api/projects");
  const projects = data?.projects || [];

  const activeCount = projects.filter((p) => p.status === "active").length;
  const planningCount = projects.filter((p) => p.status === "planning").length;

  if (loading) {
    return (
      <div className="p-4 md:p-8 flex items-center justify-center min-h-[50vh]">
        <p style={{ color: "var(--text-secondary)" }}>Loading projects...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-8 flex items-center justify-center min-h-[50vh]">
        <p style={{ color: "var(--text-error, #ef4444)" }}>Failed to load projects: {error}</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1
          className="text-3xl font-bold mb-2"
          style={{
            fontFamily: "var(--font-heading)",
            color: "var(--text-primary)",
            letterSpacing: "-1.5px",
          }}
        >
          <FolderKanban className="inline-block w-8 h-8 mr-2 mb-1" />
          Projects
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
          {projects.length} total &bull; {activeCount} active &bull; {planningCount} planning
        </p>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} onUpdate={refetch} />
        ))}
      </div>
    </div>
  );
}
