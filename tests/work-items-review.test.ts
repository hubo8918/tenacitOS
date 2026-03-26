import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let tempRoot = "";
let originalCwd = "";

let applyTaskReviewDecision: typeof import("../src/lib/work-item-review").applyTaskReviewDecision;
let getRecentWorkItemReviewDecisions: typeof import("../src/lib/work-items").getRecentWorkItemReviewDecisions;
let getWorkItemEntity: typeof import("../src/lib/work-items").getWorkItemEntity;
let getAgentTasks: typeof import("../src/lib/agent-tasks-data").getAgentTasks;
let saveAgentTasks: typeof import("../src/lib/agent-tasks-data").saveAgentTasks;

before(async () => {
  originalCwd = process.cwd();
  tempRoot = await mkdtemp(path.join(os.tmpdir(), "mission-control-work-items-"));

  await mkdir(path.join(tempRoot, "data"), { recursive: true });
  await writeFile(
    path.join(tempRoot, "data", "agent-tasks.json"),
    JSON.stringify(
      [
        {
          id: "task-review-snapshot",
          title: "Review snapshot task",
          project: "Mission Control",
          status: "pending",
          priority: "medium",
          dueDate: "2026-03-31",
          assigneeAgentId: "codex",
          reviewerAgentId: "henry",
          handoffToAgentId: "",
          blockedByTaskIds: [],
          runStatus: "needs_review",
          executionMode: "manual",
          deliverable: "",
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
  await writeFile(path.join(tempRoot, "data", "projects.json"), "[]", "utf-8");

  process.chdir(tempRoot);

  ({ applyTaskReviewDecision } = await import(
    pathToFileURL(path.join(REPO_ROOT, "src/lib/work-item-review.ts")).href
  ));
  ({ getRecentWorkItemReviewDecisions, getWorkItemEntity } = await import(
    pathToFileURL(path.join(REPO_ROOT, "src/lib/work-items.ts")).href
  ));
  ({ getAgentTasks, saveAgentTasks } = await import(
    pathToFileURL(path.join(REPO_ROOT, "src/lib/agent-tasks-data.ts")).href
  ));
});

after(async () => {
  process.chdir(originalCwd);
  if (tempRoot) {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("review decisions keep reviewer snapshots even after reviewer reassignment", async () => {
  await applyTaskReviewDecision("task-review-snapshot", {
    decision: "rework",
    note: "Needs a tighter implementation pass.",
  });

  const tasks = await getAgentTasks();
  const updatedTask = tasks.find((task) => task.id === "task-review-snapshot");
  assert.ok(updatedTask);
  await saveAgentTasks(
    tasks.map((task) =>
      task.id === "task-review-snapshot" ? { ...task, reviewerAgentId: "ralph" } : task
    )
  );

  const decisions = await getRecentWorkItemReviewDecisions({ reviewer: "ralph", limit: 5 });
  const snapshotDecision = decisions.find((decision) => decision.itemId === "task-review-snapshot");
  assert.ok(snapshotDecision);
  assert.equal(snapshotDecision?.reviewerAgentId, "henry");
  assert.equal(snapshotDecision?.reviewerName, "Henry");

  const entity = await getWorkItemEntity({ kind: "task", itemId: "task-review-snapshot" });
  assert.equal(entity.item?.reviewerAgentId, "ralph");
  assert.equal(entity.item?.latestReviewDecision?.reviewerAgentId, "henry");
  assert.equal(entity.item?.latestReviewDecision?.reviewerName, "Henry");
  assert.equal(entity.history[0]?.fields?.reviewerName, "Henry");
});
