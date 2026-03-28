import assert from "node:assert/strict";
import test from "node:test";

import type { Project } from "@/data/mockProjectsData";
import type { Task } from "@/data/mockTasksData";
import { applyDerivedProjectProgress, deriveProjectProgress } from "@/lib/project-progress";

const baseProject: Project = {
  id: "mission-control",
  title: "Mission Control",
  description: "Test project",
  status: "active",
  progress: 0,
  priority: "high",
  agent: { emoji: "x", name: "Henry", color: "#fff" },
  updatedAgo: "just now",
  updatedBy: "Henry",
  ownerAgentId: "henry",
  participatingAgentIds: ["henry", "codex"],
  phases: [
    {
      id: "phase-1",
      title: "Execution",
      status: "completed",
      ownerAgentId: "codex",
      reviewerAgentId: "henry",
      dependsOnPhaseIds: [],
    },
    {
      id: "phase-2",
      title: "QA",
      status: "in_progress",
      ownerAgentId: "ralph",
      reviewerAgentId: "henry",
      dependsOnPhaseIds: ["phase-1"],
    },
  ],
};

const linkedTasks: Task[] = [
  {
    id: "task-001",
    title: "Build envelope",
    status: "completed",
    priority: "high",
    agent: { id: "codex", emoji: "x", name: "Codex", color: "#fff" },
    project: "Mission Control",
    projectId: "mission-control",
    dueDate: "2026-03-30",
  },
  {
    id: "task-002",
    title: "QA pass",
    status: "in_progress",
    priority: "medium",
    agent: { id: "ralph", emoji: "x", name: "Ralph", color: "#fff" },
    project: "Mission Control",
    projectId: "mission-control",
    dueDate: "2026-03-31",
  },
];

test("deriveProjectProgress rolls up phases and linked tasks", () => {
  const progress = deriveProjectProgress(baseProject, linkedTasks);
  assert.equal(progress, 78);
});

test("applyDerivedProjectProgress updates project progress in-place for responses", () => {
  const projects = applyDerivedProjectProgress([{ ...baseProject }], linkedTasks);
  assert.equal(projects[0].progress, 78);
});
