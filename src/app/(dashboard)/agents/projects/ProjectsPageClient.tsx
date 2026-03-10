"use client";

import { FolderKanban } from "lucide-react";
import { ProjectCard } from "@/components/ProjectCard";
import type { Project } from "@/data/mockProjectsData";
import { useFetch } from "@/lib/useFetch";

interface ProjectsPageClientProps {
  initialProjects: Project[];
}

export default function ProjectsPageClient({ initialProjects }: ProjectsPageClientProps) {
  const hasInitialProjects = initialProjects.length > 0;
  const { data, loading, error, refetch } = useFetch<{ projects: Project[] }>("/api/projects", {
    initialData: hasInitialProjects ? { projects: initialProjects } : null,
    fetchOnMount: !hasInitialProjects,
  });
  const projects = data?.projects || [];

  const activeCount = projects.filter((p) => p.status === "active").length;
  const planningCount = projects.filter((p) => p.status === "planning").length;

  if (loading && !data) {
    return (
      <div className="p-4 md:p-8 flex items-center justify-center min-h-[50vh]">
        <p style={{ color: "var(--text-secondary)" }}>Loading projects...</p>
      </div>
    );
  }

  if (error && projects.length === 0) {
    return (
      <div className="p-4 md:p-8 flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <p style={{ color: "var(--text-error, #ef4444)" }}>Failed to load projects: {error}</p>
        <button
          onClick={refetch}
          className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
          style={{
            backgroundColor: "var(--surface-elevated)",
            color: "var(--text-primary)",
            border: "1px solid var(--border)",
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} onUpdate={refetch} />
        ))}
      </div>
    </div>
  );
}
