import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let tempRoot = "";
let originalCwd = "";

let applyManagerActionPlan: typeof import("../src/app/api/team/actions/route").applyManagerActionPlan;

const baseProject = {
  id: "project-mission-control",
  title: "Mission Control",
  description: "Project control plane",
  status: "active",
  progress: 0,
  priority: "medium",
  agent: {
    emoji: "👑",
    name: "Henry",
    color: "#FFD700",
  },
  updatedAgo: "just now",
  updatedBy: "Henry",
  ownerAgentId: "henry",
  participatingAgentIds: ["henry"],
  phases: [
    {
      id: "phase-plan",
      title: "Planning",
      status: "in_progress",
      ownerAgentId: "henry",
      reviewerAgentId: "ralph",
      handoffToAgentId: "scout",
      dependsOnPhaseIds: [],
    },
  ],
};

const baseTask = {
  id: "task-001",
  title: "Track launch readiness",
  project: "Mission Control",
  projectId: "project-mission-control",
  status: "pending",
  priority: "medium",
  dueDate: "2026-03-31",
  assigneeAgentId: "codex",
  reviewerAgentId: "henry",
  handoffToAgentId: "charlie",
  blockedByTaskIds: [],
  executionMode: "manual",
  runStatus: "idle",
  deliverable: "",
  agent: {
    id: "codex",
    emoji: "💻",
    name: "Codex",
    color: "#FF453A",
  },
};

async function writeBaselineData() {
  await mkdir(path.join(tempRoot, "data"), { recursive: true });
  await writeFile(path.join(tempRoot, "data", "projects.json"), JSON.stringify([baseProject], null, 2), "utf-8");
  await writeFile(path.join(tempRoot, "data", "agent-tasks.json"), JSON.stringify([baseTask], null, 2), "utf-8");
  await rm(path.join(tempRoot, "data", "team.json"), { force: true });
}

before(async () => {
  originalCwd = process.cwd();
  tempRoot = await mkdtemp(path.join(os.tmpdir(), "mission-control-manager-actions-"));
  process.chdir(tempRoot);

  ({ applyManagerActionPlan } = await import(
    pathToFileURL(path.join(REPO_ROOT, "src/app/api/team/actions/route.ts")).href
  ));
});

after(async () => {
  process.chdir(originalCwd);
  if (tempRoot) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        await rm(tempRoot, { recursive: true, force: true });
        break;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EBUSY") {
          throw error;
        }
        if (attempt === 4) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  }
});

test("manager actions can update existing linked tasks by task id", async () => {
  await writeBaselineData();

  const result = await applyManagerActionPlan(
    {
      createTasks: [],
      updateTasks: [
        {
          taskId: "task-001",
          title: "Track launch readiness",
          assigneeAgentId: "ralph",
          reviewerAgentId: "scout",
          handoffToAgentId: "quill",
          status: "in_progress",
        },
      ],
      phaseUpdate: null,
    },
    {
      id: "henry",
      name: "Henry",
      role: "Chief of Staff",
      description: "Coordinates work",
      tags: [],
      reportsTo: null,
      canReviewFor: [],
      canDelegateTo: ["ralph", "scout", "quill"],
      canReviewForIds: [],
      canDelegateToIds: ["ralph", "scout", "quill"],
      model: "openai-codex/gpt-5.4",
      workspace: "workspace",
    },
    {
      projectId: "project-mission-control",
      projectTitle: "Mission Control",
      projectStatus: "active",
      projectPriority: "medium",
      projectOwner: "Henry",
      projectOwnerAgentId: "henry",
      phaseId: "phase-plan",
      phaseTitle: "Planning",
      phaseStatus: "in_progress",
      phaseOwner: "Henry",
      phaseOwnerAgentId: "henry",
      phaseReviewer: "Ralph",
      phaseReviewerAgentId: "ralph",
      phaseHandoff: "Scout",
      phaseHandoffAgentId: "scout",
      dependencies: [],
      linkedTaskSummary: "Track launch readiness",
    }
  );

  assert.equal(result.createdTasks.length, 0);
  assert.equal(result.updatedTasks.length, 1);
  assert.equal(result.updatedTasks[0].id, "task-001");
  assert.equal(result.updatedTasks[0].assigneeAgentId, "ralph");
  assert.equal(result.updatedTasks[0].reviewerAgentId, "scout");
  assert.equal(result.updatedTasks[0].handoffToAgentId, "quill");
  assert.equal(result.updatedTasks[0].status, "in_progress");

  const { getAgentTasks } = await import(
    pathToFileURL(path.join(REPO_ROOT, "src/lib/agent-tasks-data.ts")).href
  );
  const tasks = await getAgentTasks();
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].assigneeAgentId, "ralph");
  assert.equal(tasks[0].reviewerAgentId, "scout");
  assert.equal(tasks[0].handoffToAgentId, "quill");
  assert.equal(tasks[0].status, "in_progress");
});

test("manager actions reject task updates that violate routing policy", async () => {
  await writeBaselineData();
  await writeFile(
    path.join(tempRoot, "data", "team.json"),
    JSON.stringify(
      [
        {
          id: "scout",
          canReviewFor: ["quill"],
          canDelegateTo: [],
        },
      ],
      null,
      2
    ),
    "utf-8"
  );

  await assert.rejects(
    () =>
      applyManagerActionPlan(
        {
          createTasks: [],
          updateTasks: [
            {
              taskId: "task-001",
              title: "Track launch readiness",
              assigneeAgentId: "ralph",
              reviewerAgentId: "scout",
              handoffToAgentId: null,
              status: "pending",
            },
          ],
          phaseUpdate: null,
        },
        {
          id: "henry",
          name: "Henry",
          role: "Chief of Staff",
          description: "Coordinates work",
          tags: [],
          reportsTo: null,
          canReviewFor: [],
          canDelegateTo: ["ralph", "scout"],
          canReviewForIds: [],
          canDelegateToIds: ["ralph", "scout"],
          model: "openai-codex/gpt-5.4",
          workspace: "workspace",
        },
        {
          projectId: "project-mission-control",
          projectTitle: "Mission Control",
          projectStatus: "active",
          projectPriority: "medium",
          projectOwner: "Henry",
          projectOwnerAgentId: "henry",
          phaseId: "phase-plan",
          phaseTitle: "Planning",
          phaseStatus: "in_progress",
          phaseOwner: "Henry",
          phaseOwnerAgentId: "henry",
          phaseReviewer: "Ralph",
          phaseReviewerAgentId: "ralph",
          phaseHandoff: "Scout",
          phaseHandoffAgentId: "scout",
          dependencies: [],
          linkedTaskSummary: "Track launch readiness",
        }
      ),
    /not configured to review work for/
  );
});
