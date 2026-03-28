import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { after, before, test } from "node:test";
import { mkdtemp, mkdir, rm, writeFile, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const TSX_ENTRY = pathToFileURL(require.resolve("tsx")).href;

let tempRoot = "";
let originalCwd = "";

before(async () => {
  originalCwd = process.cwd();
  tempRoot = await mkdtemp(path.join(os.tmpdir(), "mission-control-migrations-"));

  await mkdir(path.join(tempRoot, "data"), { recursive: true });
  await writeFile(
    path.join(tempRoot, "data", "projects.json"),
    JSON.stringify(
      [
        {
          id: "mission-control",
          title: "Mission Control",
          description: "Legacy project payload",
          status: "active",
          progress: 71,
          priority: "high",
          agent: {
            emoji: "legacy",
            name: "Henry",
            color: "#FFD700",
          },
          updatedAgo: "8 days ago",
          updatedBy: "Henry",
        },
      ],
      null,
      2
    ),
    "utf-8"
  );
  await writeFile(
    path.join(tempRoot, "data", "agent-tasks.json"),
    JSON.stringify(
      [
        {
          id: "task-003",
          title: "Build Projects page UI with mock data",
          status: "completed",
          priority: "high",
          agent: {
            name: "Codex",
            emoji: "legacy",
            color: "#FF453A",
          },
          project: "Mission Control",
          dueDate: "2026-03-07",
        },
      ],
      null,
      2
    ),
    "utf-8"
  );

  process.chdir(tempRoot);
});

after(async () => {
  process.chdir(originalCwd);
  if (tempRoot) {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("legacy project data is upgraded with seeded phases and owner routing", async () => {
  const { getProjects } = await import(pathToFileURL(path.join(REPO_ROOT, "src/lib/projects-data.ts")).href);
  const projects = await getProjects();
  assert.equal(projects.length, 1);

  const missionControl = projects[0];
  assert.equal(missionControl.ownerAgentId, "henry");
  assert.ok(missionControl.participatingAgentIds.includes("henry"));
  assert.ok(missionControl.phases.length >= 1);
  assert.equal(missionControl.phases[0]?.reviewerAgentId, "henry");
  assert.equal(missionControl.phases[0]?.latestRun?.runStatus, "needs_review");

  const persisted = JSON.parse(
    await readFile(path.join(tempRoot, "data", "projects.json"), "utf-8")
  ) as Array<Record<string, unknown>>;
  assert.ok(Array.isArray(persisted[0]?.phases));
  assert.equal((persisted[0]?.phases as Array<Record<string, unknown>>)[0]?.reviewerAgentId, "henry");
});

test("legacy task data is upgraded with routing and reviewable run state", async () => {
  const { getAgentTasks } = await import(pathToFileURL(path.join(REPO_ROOT, "src/lib/agent-tasks-data.ts")).href);
  const tasks = await getAgentTasks();
  assert.equal(tasks.length, 1);

  const task = tasks[0];
  assert.equal(task.assigneeAgentId, "codex");
  assert.equal(task.reviewerAgentId, "henry");
  assert.equal(task.projectId, "mission-control");
  assert.equal(task.runStatus, "needs_review");
  assert.equal(task.latestRun?.runStatus, "needs_review");

  const persisted = JSON.parse(
    await readFile(path.join(tempRoot, "data", "agent-tasks.json"), "utf-8")
  ) as Array<Record<string, unknown>>;
  assert.equal(persisted[0]?.assigneeAgentId, "codex");
  assert.equal(persisted[0]?.reviewerAgentId, "henry");
  assert.equal(persisted[0]?.projectId, "mission-control");
});

test("missing startup data is bootstrapped from seeded projects and tasks", async () => {
  const bootstrapRoot = await mkdtemp(path.join(os.tmpdir(), "mission-control-bootstrap-"));

  try {
    await mkdir(path.join(bootstrapRoot, "data"), { recursive: true });

    const script = `
      import assert from "node:assert/strict";
      import { pathToFileURL } from "node:url";
      const projectsModule = (await import(${JSON.stringify(pathToFileURL(path.join(REPO_ROOT, "src/lib/projects-data.ts")).href)})).default;
      const tasksModule = (await import(${JSON.stringify(pathToFileURL(path.join(REPO_ROOT, "src/lib/agent-tasks-data.ts")).href)})).default;
      const projects = await projectsModule.getProjects();
      const tasks = await tasksModule.getAgentTasks();
      assert.ok(projects.length > 0);
      assert.ok(tasks.length > 0);
      assert.ok(projects.some((project) => project.phases.length > 0));
      assert.ok(tasks.some((task) => task.reviewerAgentId || task.runStatus === "needs_review"));
    `;

    const result = spawnSync(
      process.execPath,
      ["--import", TSX_ENTRY, "--input-type=module", "--eval", script],
      {
        cwd: bootstrapRoot,
        encoding: "utf-8",
        env: {
          ...process.env,
          TSX_TSCONFIG_PATH: path.join(REPO_ROOT, "tsconfig.json"),
        },
      }
    );

    assert.equal(result.status, 0, result.stderr || result.stdout);

    const persistedProjects = JSON.parse(
      await readFile(path.join(bootstrapRoot, "data", "projects.json"), "utf-8")
    ) as Array<Record<string, unknown>>;
    const persistedTasks = JSON.parse(
      await readFile(path.join(bootstrapRoot, "data", "agent-tasks.json"), "utf-8")
    ) as Array<Record<string, unknown>>;

    assert.ok(persistedProjects.length > 0);
    assert.ok(persistedTasks.length > 0);
    assert.ok(Array.isArray(persistedProjects[0]?.phases));
    assert.ok(
      (persistedTasks[0]?.reviewerAgentId && typeof persistedTasks[0]?.reviewerAgentId === "string") ||
        (persistedTasks[0]?.runStatus && typeof persistedTasks[0]?.runStatus === "string")
    );
  } finally {
    await rm(bootstrapRoot, { recursive: true, force: true });
  }
});

test("corrupted startup data throws instead of pretending everything is empty", async () => {
  const corruptedRoot = await mkdtemp(path.join(os.tmpdir(), "mission-control-corrupted-"));

  try {
    await mkdir(path.join(corruptedRoot, "data"), { recursive: true });
    await writeFile(path.join(corruptedRoot, "data", "projects.json"), "{ not valid json", "utf-8");
    await writeFile(path.join(corruptedRoot, "data", "agent-tasks.json"), "{ not valid json", "utf-8");

    const script = `
      const projectsModule = await import(${JSON.stringify(pathToFileURL(path.join(REPO_ROOT, "src/lib/projects-data.ts")).href)});
      const tasksModule = await import(${JSON.stringify(pathToFileURL(path.join(REPO_ROOT, "src/lib/agent-tasks-data.ts")).href)});
      await Promise.all([
        projectsModule.default.getProjects().then(() => {
          throw new Error("projects should have failed");
        }, (error) => {
          if (!(error instanceof Error) || !error.message.includes("corrupted JSON")) {
            throw error;
          }
        }),
        tasksModule.default.getAgentTasks().then(() => {
          throw new Error("tasks should have failed");
        }, (error) => {
          if (!(error instanceof Error) || !error.message.includes("corrupted JSON")) {
            throw error;
          }
        }),
      ]);
    `;

    const result = spawnSync(
      process.execPath,
      ["--import", TSX_ENTRY, "--input-type=module", "--eval", script],
      {
        cwd: corruptedRoot,
        encoding: "utf-8",
        env: {
          ...process.env,
          TSX_TSCONFIG_PATH: path.join(REPO_ROOT, "tsconfig.json"),
        },
      }
    );

    assert.equal(result.status, 0, result.stderr || result.stdout);
  } finally {
    await rm(corruptedRoot, { recursive: true, force: true });
  }
});
