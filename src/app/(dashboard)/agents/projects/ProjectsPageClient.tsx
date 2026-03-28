"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";

import type {
  ReviewDecisionAgentOption,
  ReviewDecisionSubmitPayload,
} from "@/components/ReviewDecisionComposer";
import { ProjectCard } from "@/components/ProjectCard";
import { WorkItemInspector } from "@/components/WorkItemInspector";
import { priorityConfig, statusConfig, type Project, type ProjectPhase } from "@/data/mockProjectsData";
import type { Task } from "@/data/mockTasksData";
import { summarizeProjectHealth } from "@/lib/project-progress";
import { normalizeProjectLabel, resolveProjectForTask } from "@/lib/project-task-linkage";
import { useFetch } from "@/lib/useFetch";

interface ProjectsPageClientProps {
  initialProjects: Project[];
  initialTeam: ProjectAgentOption[];
  initialTasks: Task[];
  initialTasksAvailable: boolean;
}

interface ProjectAgentOption extends ReviewDecisionAgentOption {
  canReviewFor: string[];
  canDelegateTo: string[];
}

function getCurrentPhase(project: Project): ProjectPhase | null {
  return (
    project.phases.find((phase) => phase.status === "in_progress") ||
    project.phases.find((phase) => phase.status === "pending") ||
    project.phases[0] ||
    null
  );
}

function sameStringList(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function buildPhaseId(title: string, existingIds: string[]) {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "phase";
  let nextId = base;
  let counter = 2;
  while (existingIds.includes(nextId)) {
    nextId = `${base}-${counter}`;
    counter += 1;
  }
  return nextId;
}

export default function ProjectsPageClient({
  initialProjects,
  initialTeam,
  initialTasks,
  initialTasksAvailable,
}: ProjectsPageClientProps) {
  const searchParams = useSearchParams();
  const requestedProjectId = searchParams.get("projectId")?.trim() || "";
  const requestedPhaseId = searchParams.get("phaseId")?.trim() || "";
  const focusedProjectLabel = searchParams.get("project")?.trim() || "";
  const normalizedFocusedProjectLabel = normalizeProjectLabel(focusedProjectLabel);

  const { data, loading, error, refetch } = useFetch<{ projects: Project[] }>("/api/projects", {
    initialData: initialProjects.length > 0 ? { projects: initialProjects } : null,
    fetchOnMount: initialProjects.length === 0,
  });
  const {
    data: tasksData,
    error: tasksError,
    refetch: refetchTasks,
  } = useFetch<{ tasks: Task[] }>("/api/agent-tasks", {
    initialData: initialTasksAvailable ? { tasks: initialTasks } : null,
    fetchOnMount: !initialTasksAvailable,
  });

  const projects = useMemo(() => data?.projects || [], [data]);
  const tasks = useMemo(() => tasksData?.tasks || [], [tasksData]);
  const teamAgents = useMemo(
    () => [...initialTeam].sort((left, right) => left.name.localeCompare(right.name)),
    [initialTeam]
  );
  const teamAgentMap = useMemo(
    () => new Map(teamAgents.map((agent) => [agent.id, agent])),
    [teamAgents]
  );

  const scopedProjects = useMemo(() => {
    if (requestedProjectId) {
      return projects.filter((project) => project.id === requestedProjectId);
    }
    if (normalizedFocusedProjectLabel) {
      return projects.filter((project) => normalizeProjectLabel(project.title) === normalizedFocusedProjectLabel);
    }
    return projects;
  }, [normalizedFocusedProjectLabel, projects, requestedProjectId]);

  const [selectedProjectId, setSelectedProjectId] = useState(requestedProjectId);
  const [selectedPhaseId, setSelectedPhaseId] = useState(requestedPhaseId);
  const [highlightedProjectId, setHighlightedProjectId] = useState<string | null>(null);
  const [pendingSelection, setPendingSelection] = useState<{ projectId: string; phaseId?: string | null } | null>(null);
  const [selectionBlockMessage, setSelectionBlockMessage] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newStatus, setNewStatus] = useState<Project["status"]>("planning");
  const [newPriority, setNewPriority] = useState<Project["priority"]>("medium");
  const [newOwnerAgentId, setNewOwnerAgentId] = useState("");

  const [projectTitle, setProjectTitle] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectStatus, setProjectStatus] = useState<Project["status"]>("planning");
  const [projectPriority, setProjectPriority] = useState<Project["priority"]>("medium");
  const [projectOwnerAgentId, setProjectOwnerAgentId] = useState("");
  const [projectParticipants, setProjectParticipants] = useState<string[]>([]);
  const [projectDraftDirty, setProjectDraftDirty] = useState(false);
  const [projectSaveError, setProjectSaveError] = useState<string | null>(null);
  const [savingProject, setSavingProject] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);

  const [phaseTitle, setPhaseTitle] = useState("");
  const [phaseStatus, setPhaseStatus] = useState<ProjectPhase["status"]>("pending");
  const [phaseOwnerAgentId, setPhaseOwnerAgentId] = useState("");
  const [phaseReviewerAgentId, setPhaseReviewerAgentId] = useState("");
  const [phaseHandoffAgentId, setPhaseHandoffAgentId] = useState("");
  const [phaseDependencyIds, setPhaseDependencyIds] = useState<string[]>([]);
  const [phaseDraftDirty, setPhaseDraftDirty] = useState(false);
  const [phaseSaveError, setPhaseSaveError] = useState<string | null>(null);
  const [savingPhase, setSavingPhase] = useState(false);
  const [newPhaseTitle, setNewPhaseTitle] = useState("");
  const [newPhaseStatus, setNewPhaseStatus] = useState<ProjectPhase["status"]>("pending");
  const [creatingPhase, setCreatingPhase] = useState(false);
  const [deletingPhase, setDeletingPhase] = useState(false);

  const [requestingManagerAction, setRequestingManagerAction] = useState(false);
  const [managerActionSummary, setManagerActionSummary] = useState<string | null>(null);
  const [requestingCoordinationPacket, setRequestingCoordinationPacket] = useState(false);
  const [requestingReviewPacket, setRequestingReviewPacket] = useState(false);
  const [phaseReviewPending, setPhaseReviewPending] = useState<"approve" | "rework" | "block" | null>(null);
  const [phasePacketError, setPhasePacketError] = useState<string | null>(null);
  const [inspectorRefreshNonce, setInspectorRefreshNonce] = useState(0);
  const projectLinkedTaskMap = useMemo(() => {
    const map = new Map<string, Task[]>();
    projects.forEach((project) => {
      map.set(
        project.id,
        tasks.filter((task) => resolveProjectForTask(task, projects)?.id === project.id)
      );
    });
    return map;
  }, [projects, tasks]);

  const projectHealthMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof summarizeProjectHealth>>();
    projects.forEach((project) => {
      map.set(project.id, summarizeProjectHealth(project, tasks));
    });
    return map;
  }, [projects, tasks]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );
  const selectedPhase = useMemo(
    () => selectedProject?.phases.find((phase) => phase.id === selectedPhaseId) || null,
    [selectedPhaseId, selectedProject]
  );
  const selectedProjectLinkedTasks = useMemo(
    () => (selectedProject ? projectLinkedTaskMap.get(selectedProject.id) || [] : []),
    [projectLinkedTaskMap, selectedProject]
  );
  const effectiveManagerAgentId = projectOwnerAgentId || selectedProject?.ownerAgentId || "";
  const effectiveExecutionOwnerAgentId = phaseOwnerAgentId || selectedPhase?.ownerAgentId || projectOwnerAgentId || selectedProject?.ownerAgentId || "";
  const effectiveReviewerAgentId = phaseReviewerAgentId || selectedPhase?.reviewerAgentId || "";
  const effectiveHandoffAgentId = phaseHandoffAgentId || selectedPhase?.handoffToAgentId || "";
  const managerAgent = effectiveManagerAgentId ? teamAgentMap.get(effectiveManagerAgentId) || null : null;
  const executionOwnerAgent = effectiveExecutionOwnerAgentId ? teamAgentMap.get(effectiveExecutionOwnerAgentId) || null : null;
  const reviewerAgent = effectiveReviewerAgentId ? teamAgentMap.get(effectiveReviewerAgentId) || null : null;
  const handoffAgent = effectiveHandoffAgentId ? teamAgentMap.get(effectiveHandoffAgentId) || null : null;
  const projectRoutingWarnings = useMemo(() => {
    if (!selectedProject) return [];

    const warnings: string[] = [];
    if (!effectiveManagerAgentId) {
      warnings.push("Assign a project owner so one agent can manage the project and issue manager actions.");
    }
    if (selectedPhase && !effectiveExecutionOwnerAgentId) {
      warnings.push("Assign a phase owner or a project owner before requesting coordination or manager actions.");
    }
    if (selectedPhase && !effectiveReviewerAgentId) {
      warnings.push("Assign an explicit reviewer if this phase should enter the review inbox.");
    }

    const reviewerPolicy =
      effectiveReviewerAgentId && reviewerAgent ? reviewerAgent.canReviewFor : [];
    if (
      selectedPhase &&
      effectiveExecutionOwnerAgentId &&
      effectiveReviewerAgentId &&
      reviewerPolicy.length > 0 &&
      !reviewerPolicy.includes(effectiveExecutionOwnerAgentId)
    ) {
      warnings.push(
        `${reviewerAgent?.name || effectiveReviewerAgentId} is not configured to review work for ${executionOwnerAgent?.name || effectiveExecutionOwnerAgentId}.`
      );
    }

    const executionOwnerPolicy =
      effectiveExecutionOwnerAgentId && executionOwnerAgent ? executionOwnerAgent.canDelegateTo : [];
    if (
      selectedPhase &&
      effectiveExecutionOwnerAgentId &&
      effectiveHandoffAgentId &&
      executionOwnerPolicy.length > 0 &&
      !executionOwnerPolicy.includes(effectiveHandoffAgentId)
    ) {
      warnings.push(
        `${executionOwnerAgent?.name || effectiveExecutionOwnerAgentId} is not configured to hand off phase work to ${handoffAgent?.name || effectiveHandoffAgentId}.`
      );
    }

    const managerPolicy = managerAgent?.canDelegateTo || [];
    const disallowedLinkedAssignees =
      managerPolicy.length > 0
        ? Array.from(
            new Set(
              selectedProjectLinkedTasks
                .map((task) => task.assigneeAgentId || task.agent.id || "")
                .filter(
                  (agentId) =>
                    Boolean(agentId) &&
                    agentId !== effectiveManagerAgentId &&
                    !managerPolicy.includes(agentId)
                )
            )
          )
        : [];
    if (disallowedLinkedAssignees.length > 0) {
      warnings.push(
        `${managerAgent?.name || effectiveManagerAgentId} cannot delegate to ${disallowedLinkedAssignees
          .map((agentId) => teamAgentMap.get(agentId)?.name || agentId)
          .join(", ")} under current routing policy.`
      );
    }

    return warnings;
  }, [
    effectiveExecutionOwnerAgentId,
    effectiveHandoffAgentId,
    effectiveManagerAgentId,
    effectiveReviewerAgentId,
    executionOwnerAgent,
    handoffAgent,
    managerAgent,
    reviewerAgent,
    selectedPhase,
    selectedProject,
    selectedProjectLinkedTasks,
    teamAgentMap,
  ]);

  const projectWithoutPhaseCount = useMemo(
    () => projects.filter((project) => project.phases.length === 0).length,
    [projects]
  );
  const phaseWithoutReviewerCount = useMemo(
    () =>
      projects.reduce(
        (count, project) => count + project.phases.filter((phase) => !phase.reviewerAgentId).length,
        0
      ),
    [projects]
  );
  const projectDataHint =
    projectWithoutPhaseCount > 0 || phaseWithoutReviewerCount > 0
      ? {
          title: "Routing still needs a little setup",
          lines: [
            projectWithoutPhaseCount > 0
              ? `${projectWithoutPhaseCount} project${projectWithoutPhaseCount === 1 ? "" : "s"} still need their first tracked phase.`
              : null,
            phaseWithoutReviewerCount > 0
              ? `${phaseWithoutReviewerCount} phase${phaseWithoutReviewerCount === 1 ? "" : "s"} still need a reviewer before they can enter the inbox.`
              : null,
          ].filter(Boolean) as string[],
        }
      : null;

  const projectDirty = useMemo(() => {
    if (!selectedProject || !projectDraftDirty) return false;
    return (
      projectTitle !== selectedProject.title ||
      projectDescription !== selectedProject.description ||
      projectStatus !== selectedProject.status ||
      projectPriority !== selectedProject.priority ||
      projectOwnerAgentId !== (selectedProject.ownerAgentId || "") ||
      !sameStringList(projectParticipants, selectedProject.participatingAgentIds || [])
    );
  }, [
    projectDescription,
    projectOwnerAgentId,
    projectParticipants,
    projectPriority,
    projectStatus,
    projectTitle,
    projectDraftDirty,
    selectedProject,
  ]);

  const phaseDirty = useMemo(() => {
    if (!selectedPhase || !phaseDraftDirty) return false;
    return (
      phaseTitle !== selectedPhase.title ||
      phaseStatus !== selectedPhase.status ||
      phaseOwnerAgentId !== (selectedPhase.ownerAgentId || "") ||
      phaseReviewerAgentId !== (selectedPhase.reviewerAgentId || "") ||
      phaseHandoffAgentId !== (selectedPhase.handoffToAgentId || "") ||
      !sameStringList(phaseDependencyIds, selectedPhase.dependsOnPhaseIds || [])
    );
  }, [
    phaseDependencyIds,
    phaseHandoffAgentId,
    phaseOwnerAgentId,
    phaseReviewerAgentId,
    phaseStatus,
    phaseTitle,
    phaseDraftDirty,
    selectedPhase,
  ]);

  const hasDirtyPlanning = projectDirty || phaseDirty;

  const phaseDependents = useMemo(() => {
    if (!selectedProject || !selectedPhase) return [];
    return selectedProject.phases.filter(
      (phase) => phase.id !== selectedPhase.id && phase.dependsOnPhaseIds.includes(selectedPhase.id)
    );
  }, [selectedPhase, selectedProject]);

  useEffect(() => {
    if (!selectedProject && scopedProjects.length > 0 && !hasDirtyPlanning) {
      const nextProject = scopedProjects[0];
      setSelectedProjectId(nextProject.id);
      setSelectedPhaseId(requestedPhaseId || getCurrentPhase(nextProject)?.id || nextProject.phases[0]?.id || "");
      return;
    }

    if (selectedProject && requestedProjectId && selectedProject.id !== requestedProjectId && !hasDirtyPlanning) {
      const nextProject = projects.find((project) => project.id === requestedProjectId) || null;
      if (nextProject) {
        setSelectedProjectId(nextProject.id);
        setSelectedPhaseId(requestedPhaseId || getCurrentPhase(nextProject)?.id || nextProject.phases[0]?.id || "");
      }
    }
  }, [hasDirtyPlanning, projects, requestedPhaseId, requestedProjectId, scopedProjects, selectedProject]);

  useEffect(() => {
    if (!selectedProject) return;

    setProjectTitle(selectedProject.title);
    setProjectDescription(selectedProject.description);
    setProjectStatus(selectedProject.status);
    setProjectPriority(selectedProject.priority);
    setProjectOwnerAgentId(selectedProject.ownerAgentId || "");
    setProjectParticipants([...(selectedProject.participatingAgentIds || [])]);
    setProjectDraftDirty(false);
    setProjectSaveError(null);

    const nextPhase =
      selectedProject.phases.find((phase) => phase.id === selectedPhaseId) ||
      selectedProject.phases.find((phase) => phase.id === requestedPhaseId) ||
      getCurrentPhase(selectedProject) ||
      selectedProject.phases[0] ||
      null;

    setSelectedPhaseId(nextPhase?.id || "");
    setPhaseTitle(nextPhase?.title || "");
    setPhaseStatus(nextPhase?.status || "pending");
    setPhaseOwnerAgentId(nextPhase?.ownerAgentId || "");
    setPhaseReviewerAgentId(nextPhase?.reviewerAgentId || "");
    setPhaseHandoffAgentId(nextPhase?.handoffToAgentId || "");
    setPhaseDependencyIds([...(nextPhase?.dependsOnPhaseIds || [])]);
    setPhaseDraftDirty(false);
    setPhaseSaveError(null);
    setNewPhaseTitle("");
    setNewPhaseStatus("pending");
  }, [requestedPhaseId, selectedPhaseId, selectedProject]);

  useEffect(() => {
    if (!selectedProjectId) return;
    const target = document.getElementById(`project-card-${selectedProjectId}`);
    if (!target) return;

    window.requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedProjectId(selectedProjectId);
    });
  }, [selectedProjectId]);

  useEffect(() => {
    if (!highlightedProjectId) return;
    const timeout = window.setTimeout(() => setHighlightedProjectId(null), 2500);
    return () => window.clearTimeout(timeout);
  }, [highlightedProjectId]);

  const clearSelectionBlock = () => {
    setPendingSelection(null);
    setSelectionBlockMessage(null);
  };

  const applyPendingSelection = () => {
    if (!pendingSelection) return;
    setProjectDraftDirty(false);
    setPhaseDraftDirty(false);
    setSelectedProjectId(pendingSelection.projectId);
    setSelectedPhaseId(pendingSelection.phaseId || "");
    setNewPhaseTitle("");
    setNewPhaseStatus("pending");
    clearSelectionBlock();
  };

  const attemptSelect = (projectId: string, phaseId?: string | null) => {
    if (hasDirtyPlanning) {
      setPendingSelection({ projectId, phaseId });
      setSelectionBlockMessage("Save or cancel planning edits before switching project or phase.");
      return;
    }

    setSelectedProjectId(projectId);
    setSelectedPhaseId(phaseId || "");
    clearSelectionBlock();
  };

  const resetProjectDraft = () => {
    if (!selectedProject) return;
    setProjectTitle(selectedProject.title);
    setProjectDescription(selectedProject.description);
    setProjectStatus(selectedProject.status);
    setProjectPriority(selectedProject.priority);
    setProjectOwnerAgentId(selectedProject.ownerAgentId || "");
    setProjectParticipants([...(selectedProject.participatingAgentIds || [])]);
    setProjectDraftDirty(false);
    setProjectSaveError(null);
  };

  const resetPhaseDraft = () => {
    if (!selectedPhase) return;
    setPhaseTitle(selectedPhase.title);
    setPhaseStatus(selectedPhase.status);
    setPhaseOwnerAgentId(selectedPhase.ownerAgentId || "");
    setPhaseReviewerAgentId(selectedPhase.reviewerAgentId || "");
    setPhaseHandoffAgentId(selectedPhase.handoffToAgentId || "");
    setPhaseDependencyIds([...(selectedPhase.dependsOnPhaseIds || [])]);
    setPhaseDraftDirty(false);
    setPhaseSaveError(null);
  };

  const availablePhaseDependencyOptions = useMemo(
    () =>
      selectedProject?.phases.filter((phase) => phase.id !== selectedPhase?.id) || [],
    [selectedPhase?.id, selectedProject]
  );

  const handleCreateProject = async () => {
    const trimmedTitle = newTitle.trim();
    const trimmedDescription = newDescription.trim();
    if (!trimmedTitle || !trimmedDescription) {
      setCreateError("Project title and description are required.");
      return;
    }

    setCreatingProject(true);
    setCreateError(null);

    try {
      const owner = teamAgents.find((agent) => agent.id === newOwnerAgentId) || null;
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmedTitle,
          description: trimmedDescription,
          status: newStatus,
          priority: newPriority,
          ownerAgentId: owner?.id || undefined,
          participatingAgentIds: owner ? [owner.id] : [],
          agent: owner
            ? { emoji: owner.emoji, name: owner.name, color: owner.color }
            : { emoji: " ", name: "Unassigned", color: "#8E8E93" },
          updatedAgo: "just now",
          updatedBy: "Mission Control",
        }),
      });

      const payload = (await response.json().catch(() => null)) as (Project & { error?: string }) | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to create project");
      }

      await refetch();
      setProjectDraftDirty(false);
      setPhaseDraftDirty(false);
      setSelectedProjectId(payload?.id || "");
      setSelectedPhaseId("");
      setShowCreateForm(false);
      setNewTitle("");
      setNewDescription("");
      setNewStatus("planning");
      setNewPriority("medium");
      setNewOwnerAgentId("");
    } catch (createProjectError) {
      setCreateError(createProjectError instanceof Error ? createProjectError.message : "Failed to create project");
    } finally {
      setCreatingProject(false);
    }
  };

  const handleSaveProjectMetadata = async () => {
    if (!selectedProject) return;
    const trimmedTitle = projectTitle.trim();
    const trimmedDescription = projectDescription.trim();
    if (!trimmedTitle || !trimmedDescription) {
      setProjectSaveError("Project title and description are required.");
      return;
    }

    setSavingProject(true);
    setProjectSaveError(null);

    try {
      const owner = teamAgents.find((agent) => agent.id === projectOwnerAgentId) || null;
      const response = await fetch("/api/projects", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedProject.id,
          title: trimmedTitle,
          description: trimmedDescription,
          status: projectStatus,
          priority: projectPriority,
          ownerAgentId: owner?.id || undefined,
          participatingAgentIds: projectParticipants,
          agent: owner
            ? { emoji: owner.emoji, name: owner.name, color: owner.color }
            : { emoji: " ", name: "Unassigned", color: "#8E8E93" },
          updatedAgo: "just now",
          updatedBy: "Mission Control",
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to save project metadata");
      }

      await refetch();
      setProjectDraftDirty(false);
      applyPendingSelection();
    } catch (saveError) {
      setProjectSaveError(saveError instanceof Error ? saveError.message : "Failed to save project metadata");
    } finally {
      setSavingProject(false);
    }
  };

  const handleSavePhase = async () => {
    if (!selectedProject || !selectedPhase) return;
    const trimmedTitle = phaseTitle.trim();
    if (!trimmedTitle) {
      setPhaseSaveError("Phase title is required.");
      return;
    }
    if (phaseOwnerAgentId && phaseReviewerAgentId && phaseOwnerAgentId === phaseReviewerAgentId) {
      setPhaseSaveError("Reviewer must be different from the phase owner.");
      return;
    }
    if (phaseOwnerAgentId && phaseHandoffAgentId && phaseOwnerAgentId === phaseHandoffAgentId) {
      setPhaseSaveError("Handoff target must be different from the phase owner.");
      return;
    }

    setSavingPhase(true);
    setPhaseSaveError(null);

    try {
      const nextPhases = selectedProject.phases.map((phase) =>
        phase.id === selectedPhase.id
          ? {
              ...phase,
              title: trimmedTitle,
              status: phaseStatus,
              ownerAgentId: phaseOwnerAgentId || undefined,
              reviewerAgentId: phaseReviewerAgentId || undefined,
              handoffToAgentId: phaseHandoffAgentId || undefined,
              dependsOnPhaseIds: phaseDependencyIds,
            }
          : phase
      );
      const response = await fetch("/api/projects", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedProject.id,
          phases: nextPhases,
          updatedAgo: "just now",
          updatedBy: "Mission Control",
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to save phase");
      }

      await refetch();
      setPhaseDraftDirty(false);
      setInspectorRefreshNonce((current) => current + 1);
      applyPendingSelection();
    } catch (saveError) {
      setPhaseSaveError(saveError instanceof Error ? saveError.message : "Failed to save phase");
    } finally {
      setSavingPhase(false);
    }
  };

  const handleCreatePhase = async () => {
    if (!selectedProject) return;
    const trimmedTitle = newPhaseTitle.trim();
    if (!trimmedTitle) {
      setPhaseSaveError("New phase title is required.");
      return;
    }

    setCreatingPhase(true);
    setPhaseSaveError(null);

    try {
      const nextPhaseId = buildPhaseId(trimmedTitle, selectedProject.phases.map((phase) => phase.id));
      const response = await fetch("/api/projects", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedProject.id,
          phases: [
            ...selectedProject.phases,
            {
              id: nextPhaseId,
              title: trimmedTitle,
              status: newPhaseStatus,
              ownerAgentId: projectOwnerAgentId || undefined,
              reviewerAgentId: undefined,
              handoffToAgentId: undefined,
              dependsOnPhaseIds: [],
            },
          ],
          updatedAgo: "just now",
          updatedBy: "Mission Control",
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to create phase");
      }

      await refetch();
      setPhaseDraftDirty(false);
      setSelectedPhaseId(nextPhaseId);
      setNewPhaseTitle("");
      setNewPhaseStatus("pending");
    } catch (createPhaseError) {
      setPhaseSaveError(createPhaseError instanceof Error ? createPhaseError.message : "Failed to create phase");
    } finally {
      setCreatingPhase(false);
    }
  };

  const handleDeletePhase = async () => {
    if (!selectedProject || !selectedPhase) return;
    if (phaseDependents.length > 0) {
      setPhaseSaveError(
        `Remove dependency references from ${phaseDependents.map((phase) => phase.title).join(", ")} before deleting this phase.`
      );
      return;
    }

    setDeletingPhase(true);
    setPhaseSaveError(null);

    try {
      const nextPhases = selectedProject.phases.filter((phase) => phase.id !== selectedPhase.id);
      const response = await fetch("/api/projects", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedProject.id,
          phases: nextPhases,
          updatedAgo: "just now",
          updatedBy: "Mission Control",
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to delete phase");
      }

      await refetch();
      setPhaseDraftDirty(false);
      setSelectedPhaseId(nextPhases[0]?.id || "");
      setInspectorRefreshNonce((current) => current + 1);
    } catch (deletePhaseError) {
      setPhaseSaveError(deletePhaseError instanceof Error ? deletePhaseError.message : "Failed to delete phase");
    } finally {
      setDeletingPhase(false);
    }
  };

  const handleRequestCoordinationPacket = async () => {
    if (!selectedProject || !selectedPhase) return;
    const coordinationAgentId = selectedPhase.ownerAgentId || selectedProject.ownerAgentId || "";
    if (!coordinationAgentId) {
      setPhasePacketError("Assign a phase owner or project owner before requesting a coordination packet.");
      return;
    }

    setRequestingCoordinationPacket(true);
    setPhasePacketError(null);

    try {
      const linkedTasks = (projectLinkedTaskMap.get(selectedProject.id) || []).slice(0, 12).map((task) => ({
        id: task.id,
        title: task.title,
        ownerAgentId: task.assigneeAgentId || task.agent.id || null,
        reviewerAgentId: task.reviewerAgentId || null,
        handoffToAgentId: task.handoffToAgentId || null,
        status: task.status,
      }));
      const linkedTaskSummary = (projectLinkedTaskMap.get(selectedProject.id) || [])
        .slice(0, 4)
        .map((task) => task.title)
        .join(", ");
      const ownerName = teamAgents.find((agent) => agent.id === selectedPhase.ownerAgentId)?.name || selectedPhase.ownerAgentId || null;
      const reviewerName = teamAgents.find((agent) => agent.id === selectedPhase.reviewerAgentId)?.name || selectedPhase.reviewerAgentId || null;
      const handoffName = teamAgents.find((agent) => agent.id === selectedPhase.handoffToAgentId)?.name || selectedPhase.handoffToAgentId || null;
      const response = await fetch("/api/team/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: coordinationAgentId,
          action: "check-in",
          projectPhase: {
            projectId: selectedProject.id,
            projectTitle: selectedProject.title,
            projectStatus: selectedProject.status,
            projectPriority: selectedProject.priority,
            projectOwner: selectedProject.agent.name !== "Unassigned" ? selectedProject.agent.name : null,
            phaseId: selectedPhase.id,
            phaseTitle: selectedPhase.title,
            phaseStatus: selectedPhase.status,
            phaseOwner: ownerName,
            phaseReviewer: reviewerName,
            phaseHandoff: handoffName,
            dependencies: phaseDependencyIds.map((phaseId) => selectedProject.phases.find((phase) => phase.id === phaseId)?.title || phaseId),
            linkedTaskSummary: linkedTaskSummary || null,
            linkedTasks,
          },
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to request coordination packet");
      }

      await refetch();
      setInspectorRefreshNonce((current) => current + 1);
    } catch (packetError) {
      setPhasePacketError(packetError instanceof Error ? packetError.message : "Failed to request coordination packet");
    } finally {
      setRequestingCoordinationPacket(false);
    }
  };

  const handleRequestManagerAction = async () => {
    if (!selectedProject || !selectedPhase) return;
    const managerAgentId = selectedProject.ownerAgentId || selectedPhase.ownerAgentId || "";
    if (!managerAgentId) {
      setPhasePacketError("Assign a project owner before requesting manager actions.");
      return;
    }

    setRequestingManagerAction(true);
    setPhasePacketError(null);
    setManagerActionSummary(null);

    try {
      const linkedTasks = (projectLinkedTaskMap.get(selectedProject.id) || []).slice(0, 12).map((task) => ({
        id: task.id,
        title: task.title,
        ownerAgentId: task.assigneeAgentId || task.agent.id || null,
        reviewerAgentId: task.reviewerAgentId || null,
        handoffToAgentId: task.handoffToAgentId || null,
        status: task.status,
      }));
      const linkedTaskSummary = (projectLinkedTaskMap.get(selectedProject.id) || [])
        .slice(0, 6)
        .map((task) => `${task.title} (${task.assigneeAgentId || task.agent.id || "unassigned"})`)
        .join(", ");
      const response = await fetch("/api/team/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: managerAgentId,
          action: "manage",
          projectPhase: {
            projectId: selectedProject.id,
            projectTitle: selectedProject.title,
            projectStatus: selectedProject.status,
            projectPriority: selectedProject.priority,
            projectOwner: selectedProject.agent.name !== "Unassigned" ? selectedProject.agent.name : null,
            projectOwnerAgentId: selectedProject.ownerAgentId || null,
            phaseId: selectedPhase.id,
            phaseTitle: selectedPhase.title,
            phaseStatus: selectedPhase.status,
            phaseOwner: teamAgents.find((agent) => agent.id === selectedPhase.ownerAgentId)?.name || selectedPhase.ownerAgentId || null,
            phaseOwnerAgentId: selectedPhase.ownerAgentId || null,
            phaseReviewer: teamAgents.find((agent) => agent.id === selectedPhase.reviewerAgentId)?.name || selectedPhase.reviewerAgentId || null,
            phaseReviewerAgentId: selectedPhase.reviewerAgentId || null,
            phaseHandoff: teamAgents.find((agent) => agent.id === selectedPhase.handoffToAgentId)?.name || selectedPhase.handoffToAgentId || null,
            phaseHandoffAgentId: selectedPhase.handoffToAgentId || null,
            dependencies: phaseDependencyIds.map((phaseId) => selectedProject.phases.find((phase) => phase.id === phaseId)?.title || phaseId),
            linkedTaskSummary: linkedTaskSummary || null,
            linkedTasks,
          },
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        appliedMutations?: {
          createdTasks?: Array<{ title?: string | null }>;
          updatedTasks?: Array<{ title?: string | null }>;
          phaseUpdate?: {
            status?: string | null;
            ownerAgentId?: string | null;
            reviewerAgentId?: string | null;
            handoffToAgentId?: string | null;
          } | null;
          projectProgress?: number | null;
          mutationSummary?: string | null;
        } | null;
      } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to request manager actions");
      }

      const createdTitles = payload?.appliedMutations?.createdTasks
        ?.map((task) => task.title)
        .filter((title): title is string => Boolean(title));
      const updatedTitles = payload?.appliedMutations?.updatedTasks
        ?.map((task) => task.title)
        .filter((title): title is string => Boolean(title));
      const phaseUpdate = payload?.appliedMutations?.phaseUpdate;
      const mutationSummary = payload?.appliedMutations?.mutationSummary;
      const summaryParts = [
        mutationSummary ? mutationSummary : null,
        createdTitles && createdTitles.length > 0
          ? `Created ${createdTitles.length} task${createdTitles.length === 1 ? "" : "s"}: ${createdTitles.join(", ")}.`
          : null,
        updatedTitles && updatedTitles.length > 0
          ? `Updated ${updatedTitles.length} task${updatedTitles.length === 1 ? "" : "s"}: ${updatedTitles.join(", ")}.`
          : null,
        phaseUpdate
          ? `Phase updated${phaseUpdate.status ? ` to ${phaseUpdate.status.replace(/_/g, " ")}` : ""}.`
          : null,
      ].filter((entry): entry is string => Boolean(entry));
      setManagerActionSummary(
        summaryParts.length > 0
          ? summaryParts.join(" ")
          : "Manager action completed without creating or updating tasks or phase changes."
      );

      await Promise.all([refetch(), refetchTasks()]);
      setInspectorRefreshNonce((current) => current + 1);
    } catch (managerError) {
      setPhasePacketError(managerError instanceof Error ? managerError.message : "Failed to request manager actions");
    } finally {
      setRequestingManagerAction(false);
    }
  };

  const handleRequestReviewPacket = async () => {
    if (!selectedProject || !selectedPhase || !selectedPhase.reviewerAgentId) {
      setPhasePacketError("Assign a reviewer before requesting a review packet.");
      return;
    }

    setRequestingReviewPacket(true);
    setPhasePacketError(null);

    try {
      const linkedTasks = (projectLinkedTaskMap.get(selectedProject.id) || []).slice(0, 12).map((task) => ({
        id: task.id,
        title: task.title,
        ownerAgentId: task.assigneeAgentId || task.agent.id || null,
        reviewerAgentId: task.reviewerAgentId || null,
        handoffToAgentId: task.handoffToAgentId || null,
        status: task.status,
      }));
      const linkedTaskSummary = (projectLinkedTaskMap.get(selectedProject.id) || [])
        .slice(0, 4)
        .map((task) => task.title)
        .join(", ");
      const ownerName = teamAgents.find((agent) => agent.id === selectedPhase.ownerAgentId)?.name || selectedPhase.ownerAgentId || null;
      const reviewerName = teamAgents.find((agent) => agent.id === selectedPhase.reviewerAgentId)?.name || selectedPhase.reviewerAgentId || null;
      const handoffName = teamAgents.find((agent) => agent.id === selectedPhase.handoffToAgentId)?.name || selectedPhase.handoffToAgentId || null;
      const response = await fetch("/api/team/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedPhase.reviewerAgentId,
          action: "review",
          projectPhase: {
            projectId: selectedProject.id,
            projectTitle: selectedProject.title,
            projectStatus: selectedProject.status,
            projectPriority: selectedProject.priority,
            projectOwner: selectedProject.agent.name !== "Unassigned" ? selectedProject.agent.name : null,
            phaseId: selectedPhase.id,
            phaseTitle: selectedPhase.title,
            phaseStatus: selectedPhase.status,
            phaseOwner: ownerName,
            phaseReviewer: reviewerName,
            phaseHandoff: handoffName,
            dependencies: phaseDependencyIds.map((phaseId) => selectedProject.phases.find((phase) => phase.id === phaseId)?.title || phaseId),
            linkedTaskSummary: linkedTaskSummary || null,
            linkedTasks,
          },
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to request review packet");
      }

      await refetch();
      setInspectorRefreshNonce((current) => current + 1);
    } catch (packetError) {
      setPhasePacketError(packetError instanceof Error ? packetError.message : "Failed to request review packet");
    } finally {
      setRequestingReviewPacket(false);
    }
  };

  const handleReviewSubmit = async ({ decision, note, handoffTo }: ReviewDecisionSubmitPayload) => {
    if (!selectedProject || !selectedPhase) return;

    setPhaseReviewPending(decision);
    setPhasePacketError(null);

    try {
      const response = await fetch("/api/work-items/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "phase",
          itemId: selectedPhase.id,
          projectId: selectedProject.id,
          decision,
          note,
          handoffTo: handoffTo || undefined,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to save review decision");
      }

      await refetch();
      setInspectorRefreshNonce((current) => current + 1);
    } catch (reviewError) {
      const message = reviewError instanceof Error ? reviewError.message : "Failed to save review decision";
      setPhasePacketError(message);
      throw reviewError instanceof Error ? reviewError : new Error(message);
    } finally {
      setPhaseReviewPending(null);
    }
  };

  const handleDeleteProject = async () => {
    if (!selectedProject || deletingProject) return;
    const confirmed = window.confirm(`Delete project "${selectedProject.title}" and detach its linked tasks?`);
    if (!confirmed) return;

    setDeletingProject(true);
    setProjectSaveError(null);

    try {
      const response = await fetch(
        `/api/projects?id=${encodeURIComponent(selectedProject.id)}&detachLinkedTasks=1`,
        { method: "DELETE" }
      );
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to delete project");
      }

      setSelectedProjectId("");
      setSelectedPhaseId("");
      await Promise.all([refetch(), refetchTasks()]);
      setInspectorRefreshNonce((current) => current + 1);
    } catch (deleteError) {
      setProjectSaveError(deleteError instanceof Error ? deleteError.message : "Failed to delete project");
    } finally {
      setDeletingProject(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Project Planning
          </p>
          <h1 className="mt-1 text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
            Projects
          </h1>
          <p className="mt-2 max-w-3xl text-sm" style={{ color: "var(--text-muted)", lineHeight: 1.7 }}>
            Project cards stay focused on overview and phase navigation. Project metadata, selected phase planning, and review operations now live in dedicated panels.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowCreateForm((current) => !current);
            setCreateError(null);
          }}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold"
          style={{ backgroundColor: "var(--accent)", color: "#111" }}
        >
          <Plus className="h-4 w-4" />
          {showCreateForm ? "Close create form" : "Create project"}
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-xl p-4" style={{ backgroundColor: "var(--surface-elevated)", border: "1px solid var(--border)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Visible projects
          </p>
          <p className="mt-2 text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
            {scopedProjects.length}
          </p>
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: "var(--surface-elevated)", border: "1px solid var(--border)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Active phases
          </p>
          <p className="mt-2 text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
            {projects.flatMap((project) => project.phases).filter((phase) => phase.status === "in_progress").length}
          </p>
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: "var(--surface-elevated)", border: "1px solid var(--border)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Review queue
          </p>
          <p className="mt-2 text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
            {projects.flatMap((project) => project.phases).filter((phase) => phase.latestRun?.runStatus === "needs_review").length}
          </p>
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: "var(--surface-elevated)", border: "1px solid var(--border)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Linked tasks
          </p>
          <p className="mt-2 text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
            {tasks.length}
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            Tasks stay editable on the Tasks page.
          </p>
        </div>
      </div>

      {showCreateForm && (
        <div className="rounded-xl p-4" style={{ backgroundColor: "var(--surface-elevated)", border: "1px solid var(--border)" }}>
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Create project
            </p>
            <p className="mt-1 text-sm" style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
              New projects start lean: metadata first, then phases.
            </p>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
              Title
              <input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "var(--card)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
              Description
              <textarea value={newDescription} onChange={(event) => setNewDescription(event.target.value)} rows={3} className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "var(--card)", color: "var(--text-primary)", border: "1px solid var(--border)", resize: "vertical" }} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
              Owner
              <select value={newOwnerAgentId} onChange={(event) => setNewOwnerAgentId(event.target.value)} className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "var(--card)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                <option value="">Unassigned</option>
                {teamAgents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
              Status
              <select value={newStatus} onChange={(event) => setNewStatus(event.target.value as Project["status"])} className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "var(--card)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                {Object.entries(statusConfig).map(([value, config]) => (
                  <option key={value} value={value}>
                    {config.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
              Priority
              <select value={newPriority} onChange={(event) => setNewPriority(event.target.value as Project["priority"])} className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "var(--card)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                {Object.entries(priorityConfig).map(([value, config]) => (
                  <option key={value} value={value}>
                    {config.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {createError && (
            <p className="mt-3 text-sm" style={{ color: "var(--status-blocked)" }}>
              {createError}
            </p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setShowCreateForm(false)} className="rounded-lg px-4 py-2 text-sm font-semibold" style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
              Cancel
            </button>
            <button type="button" onClick={handleCreateProject} disabled={creatingProject} className="rounded-lg px-4 py-2 text-sm font-semibold" style={{ backgroundColor: "var(--accent)", color: "#111", opacity: creatingProject ? 0.6 : 1 }}>
              {creatingProject ? "Creating..." : "Create project"}
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(380px,0.9fr)]">
        <div className="space-y-4">
          {error && (
            <div className="rounded-xl p-4" style={{ backgroundColor: "var(--surface-elevated)", border: "1px solid var(--border)" }}>
              <p className="text-sm" style={{ color: "var(--status-blocked)" }}>
                {error}
              </p>
            </div>
          )}
          {tasksError && (
            <div className="rounded-xl p-4" style={{ backgroundColor: "var(--surface-elevated)", border: "1px solid var(--border)" }}>
              <p className="text-sm" style={{ color: "var(--status-blocked)" }}>
                {tasksError}
              </p>
            </div>
          )}

          {projectDataHint && (
            <div className="rounded-xl p-4" style={{ backgroundColor: "color-mix(in srgb, #0A84FF 10%, var(--surface-elevated))", border: "1px solid color-mix(in srgb, #0A84FF 22%, transparent)" }}>
              <p className="text-sm font-semibold" style={{ color: "#0A84FF" }}>
                {projectDataHint.title}
              </p>
              <div className="mt-2 space-y-1 text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
                {projectDataHint.lines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </div>
          )}

          {loading && scopedProjects.length === 0 ? (
            <div className="rounded-xl p-4" style={{ backgroundColor: "var(--surface-elevated)", border: "1px solid var(--border)" }}>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Loading projects...
              </p>
            </div>
          ) : scopedProjects.length === 0 ? (
            <div className="rounded-xl p-4" style={{ backgroundColor: "var(--surface-elevated)", border: "1px solid var(--border)" }}>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                No projects match the current focus.
              </p>
              <p className="mt-2 text-sm" style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
                Clear the project link filter or open a different project to continue planning.
              </p>
            </div>
          ) : (
            scopedProjects.map((project) => (
              <ProjectCard
                key={project.id}
                cardId={`project-card-${project.id}`}
                project={project}
                linkedTaskCount={(projectLinkedTaskMap.get(project.id) || []).length}
                healthSummary={projectHealthMap.get(project.id) || null}
                selectedPhaseId={project.id === selectedProjectId ? selectedPhaseId : null}
                isSelectedProject={project.id === selectedProjectId}
                isTemporarilyHighlighted={project.id === highlightedProjectId}
                onSelectProject={() => attemptSelect(project.id, null)}
                onSelectPhase={(phaseId) => attemptSelect(project.id, phaseId)}
              />
            ))
          )}
        </div>

        <div className="space-y-4">
          {selectionBlockMessage && (
            <div className="rounded-xl p-4" style={{ backgroundColor: "color-mix(in srgb, #FF9F0A 10%, var(--surface-elevated))", border: "1px solid color-mix(in srgb, #FF9F0A 24%, transparent)" }}>
              <p className="text-sm font-semibold" style={{ color: "#FF9F0A" }}>
                Planning changes are still unsaved
              </p>
              <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
                {selectionBlockMessage}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={applyPendingSelection} className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ color: "#111", backgroundColor: "#FF9F0A" }}>
                  Discard changes and switch
                </button>
                <button type="button" onClick={clearSelectionBlock} className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                  Stay here
                </button>
              </div>
            </div>
          )}

          <div className="rounded-xl p-4" style={{ backgroundColor: "var(--surface-elevated)", border: "1px solid var(--border)" }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Project Metadata
            </p>
            {selectedProject ? (
              <div className="mt-3 space-y-4">
                {projectHealthMap.get(selectedProject.id) ? (
                  <div
                    className="grid gap-3 md:grid-cols-4"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    <div className="rounded-lg px-3 py-2" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                      <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                        Phase completion
                      </p>
                      <p className="mt-1 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                        {projectHealthMap.get(selectedProject.id)?.completedPhaseCount}/{projectHealthMap.get(selectedProject.id)?.phaseCount}
                      </p>
                    </div>
                    <div className="rounded-lg px-3 py-2" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                      <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                        Tasks in flight
                      </p>
                      <p className="mt-1 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                        {projectHealthMap.get(selectedProject.id)?.inProgressTaskCount || 0}
                      </p>
                    </div>
                    <div className="rounded-lg px-3 py-2" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                      <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                        Waiting review
                      </p>
                      <p className="mt-1 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                        {projectHealthMap.get(selectedProject.id)?.needsReviewPhaseCount || 0}
                      </p>
                    </div>
                    <div className="rounded-lg px-3 py-2" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                      <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                        Blocked items
                      </p>
                      <p className="mt-1 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                        {(projectHealthMap.get(selectedProject.id)?.blockedPhaseCount || 0) + (projectHealthMap.get(selectedProject.id)?.blockedTaskCount || 0)}
                      </p>
                    </div>
                  </div>
                ) : null}
                <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                  Title
                  <input value={projectTitle} onChange={(event) => { setProjectTitle(event.target.value); setProjectDraftDirty(true); }} className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "var(--card)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                  Description
                  <textarea value={projectDescription} onChange={(event) => { setProjectDescription(event.target.value); setProjectDraftDirty(true); }} rows={4} className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "var(--card)", color: "var(--text-primary)", border: "1px solid var(--border)", resize: "vertical" }} />
                </label>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                    Status
                    <select value={projectStatus} onChange={(event) => { setProjectStatus(event.target.value as Project["status"]); setProjectDraftDirty(true); }} className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "var(--card)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                      {Object.entries(statusConfig).map(([value, config]) => (
                        <option key={value} value={value}>
                          {config.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                    Priority
                    <select value={projectPriority} onChange={(event) => { setProjectPriority(event.target.value as Project["priority"]); setProjectDraftDirty(true); }} className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "var(--card)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                      {Object.entries(priorityConfig).map(([value, config]) => (
                        <option key={value} value={value}>
                          {config.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                    <span>Derived progress</span>
                    <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "var(--card)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                      {selectedProject.progress}%
                    </div>
                    <p className="text-xs" style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>
                      Computed from phase state and linked task status.
                    </p>
                  </div>
                  <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                    Owner
                    <select value={projectOwnerAgentId} onChange={(event) => { setProjectOwnerAgentId(event.target.value); setProjectDraftDirty(true); }} className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "var(--card)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                      <option value="">Unassigned</option>
                      {teamAgents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                  Participating agents
                  <select
                    multiple
                    value={projectParticipants}
                    onChange={(event) => {
                      setProjectParticipants(Array.from(event.target.selectedOptions).map((option) => option.value));
                      setProjectDraftDirty(true);
                    }}
                    className="rounded-lg px-3 py-2 text-sm"
                    style={{ backgroundColor: "var(--card)", color: "var(--text-primary)", border: "1px solid var(--border)", minHeight: "120px" }}
                  >
                    {teamAgents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name}
                      </option>
                    ))}
                  </select>
                </label>
                {projectSaveError && (
                  <p className="text-sm" style={{ color: "var(--status-blocked)" }}>
                    {projectSaveError}
                  </p>
                )}
                <div className="flex flex-wrap justify-between gap-2">
                  <button type="button" onClick={handleDeleteProject} disabled={deletingProject} className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ color: "#FF453A", border: "1px solid color-mix(in srgb, #FF453A 24%, transparent)", opacity: deletingProject ? 0.6 : 1 }}>
                    {deletingProject ? "Deleting..." : "Delete project"}
                  </button>
                  <div className="flex gap-2">
                    <button type="button" onClick={resetProjectDraft} className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                      Cancel metadata
                    </button>
                    <button type="button" onClick={handleSaveProjectMetadata} disabled={savingProject || !projectDirty} className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ backgroundColor: "var(--accent)", color: "#111", opacity: savingProject || !projectDirty ? 0.6 : 1 }}>
                      {savingProject ? "Saving..." : "Save metadata"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>
                Select a project to edit its planning metadata, or create a new project above.
              </p>
            )}
          </div>

          <div className="rounded-xl p-4" style={{ backgroundColor: "var(--surface-elevated)", border: "1px solid var(--border)" }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Execution Readiness
            </p>
            {selectedProject ? (
              <div className="mt-3 space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg p-3" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                      Manager agent
                    </p>
                    <p className="mt-2 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      {managerAgent?.name || "Unassigned"}
                    </p>
                    <p className="mt-1 text-xs" style={{ color: "var(--text-muted)", lineHeight: 1.5 }}>
                      {managerAgent
                        ? managerAgent.canDelegateTo.length > 0
                          ? `Explicit delegation scope: ${managerAgent.canDelegateTo.length} agent${managerAgent.canDelegateTo.length === 1 ? "" : "s"}.`
                          : "Open delegation scope. Manager actions can assign any agent unless a task or phase review policy blocks it."
                        : "Project-level manager actions stay disabled until a project owner is assigned."}
                    </p>
                  </div>
                  <div className="rounded-lg p-3" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                      Selected phase routing
                    </p>
                    <p className="mt-2 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      {selectedPhase ? selectedPhase.title : "No phase selected"}
                    </p>
                    <p className="mt-1 text-xs" style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
                      Owner: {executionOwnerAgent?.name || "Unassigned"} | Reviewer: {reviewerAgent?.name || "Unassigned"} | Handoff: {handoffAgent?.name || "None"}
                    </p>
                    <p className="mt-1 text-xs" style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
                      Linked tasks: {selectedProjectLinkedTasks.length}
                    </p>
                  </div>
                </div>
                {projectRoutingWarnings.length > 0 ? (
                  <div className="rounded-lg p-3" style={{ backgroundColor: "color-mix(in srgb, #FF9F0A 10%, var(--card))", border: "1px solid color-mix(in srgb, #FF9F0A 24%, transparent)" }}>
                    <p className="text-sm font-semibold" style={{ color: "#FF9F0A" }}>
                      Routing needs attention
                    </p>
                    <div className="mt-2 space-y-1 text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
                      {projectRoutingWarnings.map((warning) => (
                        <p key={warning}>{warning}</p>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg p-3" style={{ backgroundColor: "color-mix(in srgb, #32D74B 10%, var(--card))", border: "1px solid color-mix(in srgb, #32D74B 24%, transparent)" }}>
                    <p className="text-sm font-semibold" style={{ color: "#32D74B" }}>
                      Manager and review routing look coherent
                    </p>
                    <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
                      This project has enough owner and reviewer data for manager actions, coordination packets, and review inbox handoff to stay on-policy.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>
                Select a project to inspect manager ownership, phase routing, and review readiness.
              </p>
            )}
          </div>

          <div className="rounded-xl p-4" style={{ backgroundColor: "var(--surface-elevated)", border: "1px solid var(--border)" }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Phase Planning
            </p>
            {selectedProject ? (
              <div className="mt-3 space-y-4">
                {selectedPhase ? (
                  <>
                    <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                      Phase title
                      <input value={phaseTitle} onChange={(event) => { setPhaseTitle(event.target.value); setPhaseDraftDirty(true); }} className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "var(--card)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
                    </label>
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                        Status
                        <select value={phaseStatus} onChange={(event) => { setPhaseStatus(event.target.value as ProjectPhase["status"]); setPhaseDraftDirty(true); }} className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "var(--card)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                          <option value="pending">Pending</option>
                          <option value="in_progress">In progress</option>
                          <option value="blocked">Blocked</option>
                          <option value="completed">Completed</option>
                        </select>
                      </label>
                      <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                        Owner
                        <select value={phaseOwnerAgentId} onChange={(event) => { setPhaseOwnerAgentId(event.target.value); setPhaseDraftDirty(true); }} className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "var(--card)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                          <option value="">Unassigned</option>
                          {teamAgents.map((agent) => (
                            <option key={agent.id} value={agent.id}>
                              {agent.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                        Reviewer
                        <select value={phaseReviewerAgentId} onChange={(event) => { setPhaseReviewerAgentId(event.target.value); setPhaseDraftDirty(true); }} className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "var(--card)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                          <option value="">Unassigned</option>
                          {teamAgents.map((agent) => (
                            <option key={agent.id} value={agent.id}>
                              {agent.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                        Handoff target
                        <select value={phaseHandoffAgentId} onChange={(event) => { setPhaseHandoffAgentId(event.target.value); setPhaseDraftDirty(true); }} className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "var(--card)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                          <option value="">None</option>
                          {teamAgents.map((agent) => (
                            <option key={agent.id} value={agent.id}>
                              {agent.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                      Dependencies
                      <select
                        multiple
                        value={phaseDependencyIds}
                        onChange={(event) => {
                          setPhaseDependencyIds(Array.from(event.target.selectedOptions).map((option) => option.value));
                          setPhaseDraftDirty(true);
                        }}
                        className="rounded-lg px-3 py-2 text-sm"
                        style={{ backgroundColor: "var(--card)", color: "var(--text-primary)", border: "1px solid var(--border)", minHeight: "120px" }}
                      >
                        {availablePhaseDependencyOptions.map((phase) => (
                          <option key={phase.id} value={phase.id}>
                            {phase.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    {phaseSaveError && (
                      <p className="text-sm" style={{ color: "var(--status-blocked)" }}>
                        {phaseSaveError}
                      </p>
                    )}
                    <div className="flex flex-wrap justify-between gap-2">
                      <button type="button" onClick={handleDeletePhase} disabled={deletingPhase} className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ color: "#FF453A", border: "1px solid color-mix(in srgb, #FF453A 24%, transparent)", opacity: deletingPhase ? 0.6 : 1 }}>
                        {deletingPhase ? "Deleting..." : "Delete phase"}
                      </button>
                      <div className="flex gap-2">
                        <button type="button" onClick={resetPhaseDraft} className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                          Cancel phase edits
                        </button>
                        <button type="button" onClick={handleSavePhase} disabled={savingPhase || !phaseDirty} className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ backgroundColor: "var(--accent)", color: "#111", opacity: savingPhase || !phaseDirty ? 0.6 : 1 }}>
                          {savingPhase ? "Saving..." : "Save phase"}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    Select a phase from the project card to edit packet routing, review assignment, and dependencies.
                  </p>
                )}

                <div className="rounded-lg p-3" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    Add phase
                  </p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                      New phase title
                      <input value={newPhaseTitle} onChange={(event) => setNewPhaseTitle(event.target.value)} className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "var(--surface-elevated)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                      Initial status
                      <select value={newPhaseStatus} onChange={(event) => setNewPhaseStatus(event.target.value as ProjectPhase["status"])} className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: "var(--surface-elevated)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                        <option value="pending">Pending</option>
                        <option value="in_progress">In progress</option>
                        <option value="blocked">Blocked</option>
                        <option value="completed">Completed</option>
                      </select>
                    </label>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <button type="button" onClick={handleCreatePhase} disabled={creatingPhase} className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ backgroundColor: "var(--accent)", color: "#111", opacity: creatingPhase ? 0.6 : 1 }}>
                      {creatingPhase ? "Creating..." : "Create phase"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>
                Select a project to edit phase planning, or use the card list to jump to a specific phase.
              </p>
            )}
          </div>

          <WorkItemInspector
            kind={selectedPhase ? "phase" : null}
            itemId={selectedPhase?.id || null}
            projectId={selectedProject?.id || null}
            agentOptions={teamAgents}
            refreshNonce={inspectorRefreshNonce}
            defaultHandoffToAgentId={selectedPhase?.handoffToAgentId || ""}
            pendingDecision={phaseReviewPending}
            reviewDisabled={!selectedPhase || hasDirtyPlanning}
            reviewError={phasePacketError}
            onReviewSubmit={selectedPhase ? handleReviewSubmit : undefined}
            packetActions={
              selectedPhase ? (
                <div className="space-y-3">
                    <p className="text-sm" style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
                    Manager actions can create tasks, update linked task routing, and advance the selected phase. Coordination packets go to the phase owner or project owner fallback. Review packets go only to the explicitly assigned reviewer.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={handleRequestManagerAction} disabled={requestingManagerAction || hasDirtyPlanning || !selectedProject?.ownerAgentId} className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ color: "#32D74B", border: "1px solid color-mix(in srgb, #32D74B 24%, transparent)", opacity: requestingManagerAction || hasDirtyPlanning || !selectedProject?.ownerAgentId ? 0.6 : 1 }}>
                      {requestingManagerAction ? "Running..." : "Run manager action"}
                    </button>
                    <button type="button" onClick={handleRequestCoordinationPacket} disabled={requestingCoordinationPacket || hasDirtyPlanning} className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ backgroundColor: "var(--accent)", color: "#111", opacity: requestingCoordinationPacket || hasDirtyPlanning ? 0.6 : 1 }}>
                      {requestingCoordinationPacket ? "Requesting..." : "Request coordination packet"}
                    </button>
                    <button type="button" onClick={handleRequestReviewPacket} disabled={requestingReviewPacket || hasDirtyPlanning || !selectedPhase.reviewerAgentId} className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ color: "#0A84FF", border: "1px solid color-mix(in srgb, #0A84FF 24%, transparent)", opacity: requestingReviewPacket || hasDirtyPlanning || !selectedPhase.reviewerAgentId ? 0.6 : 1 }}>
                      {requestingReviewPacket ? "Requesting..." : "Request review packet"}
                    </button>
                  </div>
                  {phasePacketError && (
                    <p className="text-sm" style={{ color: "var(--status-blocked)" }}>
                      {phasePacketError}
                    </p>
                  )}
                  {managerActionSummary && !phasePacketError && (
                    <p className="text-sm" style={{ color: "#32D74B" }}>
                      {managerActionSummary}
                    </p>
                  )}
                </div>
              ) : null
            }
          />
        </div>
      </div>
    </div>
  );
}
