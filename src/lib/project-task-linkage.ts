interface ProjectLike {
  id: string;
  title: string;
}

interface TaskProjectLike {
  project: string;
  projectId?: string;
}

export function normalizeProjectLabel(value: string) {
  return value.trim().toLowerCase();
}

export function resolveProjectIdFromTaskProjectLabel(projectLabel: string, projects: ProjectLike[]): string | undefined {
  const normalizedLabel = normalizeProjectLabel(projectLabel);
  if (!normalizedLabel) {
    return undefined;
  }

  return projects.find((project) => normalizeProjectLabel(project.title) === normalizedLabel)?.id;
}

export function resolveProjectForTask<TProject extends ProjectLike>(
  task: TaskProjectLike,
  projects: TProject[]
): TProject | null {
  if (task.projectId) {
    return projects.find((project) => project.id === task.projectId) || null;
  }

  const resolvedProjectId = resolveProjectIdFromTaskProjectLabel(task.project, projects);
  if (!resolvedProjectId) {
    return null;
  }

  return projects.find((project) => project.id === resolvedProjectId) || null;
}

export function taskLinksToProject(task: TaskProjectLike, project: ProjectLike) {
  if (task.projectId) {
    return task.projectId === project.id;
  }

  return normalizeProjectLabel(task.project) === normalizeProjectLabel(project.title);
}

export function taskHasProjectMismatch(task: TaskProjectLike, projects: ProjectLike[]) {
  const hasAnyProjectReference = Boolean(task.projectId || normalizeProjectLabel(task.project));
  if (!hasAnyProjectReference) {
    return false;
  }

  return !resolveProjectForTask(task, projects);
}
