import type { Project } from "@/data/mockProjectsData";
import type { Task } from "@/data/mockTasksData";
import { taskLinksToProject } from "@/lib/project-task-linkage";

function clampProgress(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function phaseCompletionScore(project: Project) {
  if (project.phases.length === 0) return 0;

  const score = project.phases.reduce((total, phase) => {
    if (phase.status === "completed") return total + 1;
    if (phase.status === "in_progress") return total + 0.55;
    if (phase.status === "blocked") return total + 0.15;
    return total + 0.05;
  }, 0);

  return score / project.phases.length;
}

function taskCompletionScore(project: Project, tasks: Task[]) {
  const linkedTasks = tasks.filter((task) => taskLinksToProject(task, project));
  if (linkedTasks.length === 0) return null;

  const score = linkedTasks.reduce((total, task) => {
    if (task.status === "completed") return total + 1;
    if (task.status === "in_progress") return total + 0.55;
    if (task.status === "blocked") return total + 0.1;
    return total + 0.05;
  }, 0);

  return score / linkedTasks.length;
}

export function deriveProjectProgress(project: Project, tasks: Task[]) {
  const phaseScore = phaseCompletionScore(project);
  const taskScore = taskCompletionScore(project, tasks);

  if (taskScore === null) {
    return clampProgress(phaseScore * 100);
  }

  return clampProgress((phaseScore * 0.65 + taskScore * 0.35) * 100);
}

export function applyDerivedProjectProgress(projects: Project[], tasks: Task[]) {
  return projects.map((project) => ({
    ...project,
    progress: deriveProjectProgress(project, tasks),
  }));
}
