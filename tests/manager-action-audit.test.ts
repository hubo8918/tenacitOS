import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let tempRoot = "";
let originalCwd = "";

let getWorkItemEntity: typeof import("../src/lib/work-items").getWorkItemEntity;
let recordTaskRun: typeof import("../src/lib/task-runs-data").recordTaskRun;
let recordProjectPhaseRun: typeof import("../src/lib/project-phase-runs-data").recordProjectPhaseRun;

before(async () => {
  originalCwd = process.cwd();
  tempRoot = await mkdtemp(path.join(os.tmpdir(), "mission-control-manager-audit-"));

  await mkdir(path.join(tempRoot, "data"), { recursive: true });
  await writeFile(
    path.join(tempRoot, "data", "agent-tasks.json"),
    JSON.stringify(
      [
        {
          id: "task-manager-audit",
          title: "Manager audit task",
          project: "Mission Control",
          projectId: "mission-control",
          status: "in_progress",
          priority: "medium",
          dueDate: "2026-03-31",
          assigneeAgentId: "codex",
          reviewerAgentId: "henry",
          blockedByTaskIds: [],
          executionMode: "agent-run",
          runStatus: "running",
          deliverable: "Initial task deliverable",
          agent: {
            id: "codex",
            name: "Codex",
            emoji: "💻",
            color: "#FF453A",
          },
        },
      ],
      null,
      2
    ),
    "utf-8"
  );
  await writeFile(
    path.join(tempRoot, "data", "projects.json"),
    JSON.stringify(
      [
        {
          id: "mission-control",
          title: "Mission Control",
          description: "Test project",
          status: "active",
          progress: 0,
          priority: "high",
          agent: { emoji: "👔", name: "Henry", color: "#FFD700" },
          updatedAgo: "just now",
          updatedBy: "Henry",
          ownerAgentId: "henry",
          participatingAgentIds: ["henry", "codex"],
          phases: [
            {
              id: "execution-envelope",
              title: "Execution envelope",
              status: "in_progress",
              ownerAgentId: "codex",
              reviewerAgentId: "henry",
              dependsOnPhaseIds: [],
            },
          ],
        },
      ],
      null,
      2
    ),
    "utf-8"
  );

  process.chdir(tempRoot);

  ({ getWorkItemEntity } = await import(pathToFileURL(path.join(REPO_ROOT, "src/lib/work-items.ts")).href));
  ({ recordTaskRun } = await import(pathToFileURL(path.join(REPO_ROOT, "src/lib/task-runs-data.ts")).href));
  ({ recordProjectPhaseRun } = await import(
    pathToFileURL(path.join(REPO_ROOT, "src/lib/project-phase-runs-data.ts")).href
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
        if ((error as NodeJS.ErrnoException).code !== "EBUSY" || attempt === 4) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  }
});

test("manager action audit fields persist on task and phase history", async () => {
  const auditFields = {
    managerAction: "manage",
    mutationSummary: "Created 2 managed tasks and updated the execution phase.",
    createdTasks: "Draft outline, Review checklist",
    updatedTasks: "Existing routing task",
    phaseUpdate: "status=completed, owner=codex, reviewer=henry",
    projectProgress: "80%",
  };

  await recordTaskRun({
    taskId: "task-manager-audit",
    taskTitle: "Manager audit task",
    userAgent: "mission-control-tests",
    run: {
      kind: "agent_packet",
      intent: "debug",
      timestamp: "2026-03-28T10:00:00.000Z",
      runStatus: "running",
      executionMode: "agent-run",
      deliverable: "Created 2 managed tasks and updated the execution phase.",
      text: "ACTIONS_JSON:{\"createTasks\":[],\"updateTasks\":[],\"phaseUpdate\":null}",
      agentId: "henry",
      agentName: "Henry",
      model: "openai-codex/gpt-5.4",
      thinking: "low",
      fields: auditFields,
    },
  });

  await recordProjectPhaseRun({
    projectId: "mission-control",
    projectTitle: "Mission Control",
    phaseId: "execution-envelope",
    phaseTitle: "Execution envelope",
    userAgent: "mission-control-tests",
    run: {
      kind: "agent_packet",
      intent: "debug",
      timestamp: "2026-03-28T10:05:00.000Z",
      runStatus: "running",
      executionMode: "agent-run",
      deliverable: "Created 2 managed tasks and updated the execution phase.",
      text: "ACTIONS_JSON:{\"createTasks\":[],\"updateTasks\":[],\"phaseUpdate\":null}",
      agentId: "henry",
      agentName: "Henry",
      model: "openai-codex/gpt-5.4",
      thinking: "low",
      fields: auditFields,
    },
  });

  const taskEntity = await getWorkItemEntity({ kind: "task", itemId: "task-manager-audit" });
  assert.equal(taskEntity.item?.latestRun?.fields?.managerAction, "manage");
  assert.equal(taskEntity.item?.latestRun?.fields?.mutationSummary, auditFields.mutationSummary);
  assert.equal(taskEntity.history[0]?.fields?.createdTasks, auditFields.createdTasks);
  assert.equal(taskEntity.history[0]?.fields?.projectProgress, auditFields.projectProgress);

  const phaseEntity = await getWorkItemEntity({
    kind: "phase",
    itemId: "execution-envelope",
    projectId: "mission-control",
  });
  assert.equal(phaseEntity.item?.latestRun?.fields?.managerAction, "manage");
  assert.equal(phaseEntity.item?.latestRun?.fields?.phaseUpdate, auditFields.phaseUpdate);
  assert.equal(phaseEntity.history[0]?.fields?.updatedTasks, auditFields.updatedTasks);
  assert.equal(phaseEntity.history[0]?.fields?.mutationSummary, auditFields.mutationSummary);
});
