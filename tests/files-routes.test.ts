import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { NextRequest } from "next/server";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let tempRoot = "";
let openclawDir = "";
let workspaceDir = "";
let originalCwd = "";
const originalOpenClawDir = process.env.OPENCLAW_DIR;
const originalOpenClawWorkspace = process.env.OPENCLAW_WORKSPACE;

let browseRoute: typeof import("../src/app/api/browse/route");
let writeRoute: typeof import("../src/app/api/files/write/route");
let deleteRoute: typeof import("../src/app/api/files/delete/route");
let filesRoute: typeof import("../src/app/api/files/route");
let mkdirRoute: typeof import("../src/app/api/files/mkdir/route");
let uploadRoute: typeof import("../src/app/api/files/upload/route");
let downloadRoute: typeof import("../src/app/api/files/download/route");
let workspacesRoute: typeof import("../src/app/api/files/workspaces/route");
let activitiesDb: typeof import("../src/lib/activities-db");

function jsonRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function runWithMutedConsoleErrors<T>(callback: () => Promise<T>): Promise<T> {
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    return await callback();
  } finally {
    console.error = originalConsoleError;
  }
}

before(async () => {
  originalCwd = process.cwd();
  tempRoot = await mkdtemp(path.join(os.tmpdir(), "mission-control-files-"));
  openclawDir = path.join(tempRoot, ".openclaw");
  workspaceDir = path.join(openclawDir, "workspace");

  await mkdir(path.join(tempRoot, "data"), { recursive: true });
  await mkdir(path.join(workspaceDir, "memory", "journal"), { recursive: true });
  await mkdir(path.join(openclawDir, "workspace-agentx"), { recursive: true });

  await writeFile(path.join(workspaceDir, "MEMORY.md"), "# memory root\n");
  await writeFile(path.join(workspaceDir, "notes.txt"), "general notes\n");
  await writeFile(path.join(workspaceDir, "memory", "journal", "today.md"), "## today\n");
  await writeFile(
    path.join(openclawDir, "workspace-agentx", "IDENTITY.md"),
    "- **Name:** Agent X\n- **Emoji:** X\n"
  );

  process.chdir(tempRoot);
  process.env.OPENCLAW_DIR = openclawDir;
  process.env.OPENCLAW_WORKSPACE = workspaceDir;

  browseRoute = await import(pathToFileURL(path.join(REPO_ROOT, "src/app/api/browse/route.ts")).href);
  writeRoute = await import(pathToFileURL(path.join(REPO_ROOT, "src/app/api/files/write/route.ts")).href);
  deleteRoute = await import(pathToFileURL(path.join(REPO_ROOT, "src/app/api/files/delete/route.ts")).href);
  filesRoute = await import(pathToFileURL(path.join(REPO_ROOT, "src/app/api/files/route.ts")).href);
  mkdirRoute = await import(pathToFileURL(path.join(REPO_ROOT, "src/app/api/files/mkdir/route.ts")).href);
  uploadRoute = await import(pathToFileURL(path.join(REPO_ROOT, "src/app/api/files/upload/route.ts")).href);
  downloadRoute = await import(pathToFileURL(path.join(REPO_ROOT, "src/app/api/files/download/route.ts")).href);
  workspacesRoute = await import(
    pathToFileURL(path.join(REPO_ROOT, "src/app/api/files/workspaces/route.ts")).href
  );
  activitiesDb = await import(pathToFileURL(path.join(REPO_ROOT, "src/lib/activities-db.ts")).href);
});

after(async () => {
  activitiesDb.closeActivitiesDb();
  process.chdir(originalCwd);

  if (originalOpenClawDir === undefined) {
    delete process.env.OPENCLAW_DIR;
  } else {
    process.env.OPENCLAW_DIR = originalOpenClawDir;
  }

  if (originalOpenClawWorkspace === undefined) {
    delete process.env.OPENCLAW_WORKSPACE;
  } else {
    process.env.OPENCLAW_WORKSPACE = originalOpenClawWorkspace;
  }

  if (tempRoot) {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("workspace registry exposes shared workspaces", async () => {
  const response = await workspacesRoute.GET();
  assert.equal(response.status, 200);

  const payload = (await response.json()) as { workspaces: Array<{ id: string }> };
  const ids = payload.workspaces.map((workspace) => workspace.id);

  assert.ok(ids.includes("workspace"));
  assert.ok(ids.includes("workspace-agentx"));
});

test("browse rejects traversal outside the selected workspace", async () => {
  const response = await runWithMutedConsoleErrors(() =>
    browseRoute.GET(new NextRequest("http://localhost/api/browse?workspace=workspace&path=../secrets.txt"))
  );

  assert.equal(response.status, 400);
  const payload = (await response.json()) as { code: string };
  assert.equal(payload.code, "invalid_path");
});

test("browse rejects absolute paths that point at a different workspace", async () => {
  const otherWorkspacePath = path.join(openclawDir, "workspace-agentx", "IDENTITY.md");
  const response = await runWithMutedConsoleErrors(() =>
    browseRoute.GET(
      new NextRequest(
        `http://localhost/api/browse?workspace=workspace&path=${encodeURIComponent(otherWorkspacePath)}&content=true`
      )
    )
  );

  assert.equal(response.status, 400);
  const payload = (await response.json()) as { code: string };
  assert.equal(payload.code, "invalid_path");
});

test("mkdir, write, browse, and delete share one resolver", async () => {
  const mkdirResponse = await mkdirRoute.POST(
    jsonRequest("http://localhost/api/files/mkdir", "POST", {
      workspace: "workspace",
      path: "docs",
      name: "notes",
    })
  );
  assert.equal(mkdirResponse.status, 200);

  const writeResponse = await writeRoute.POST(
    jsonRequest("http://localhost/api/files/write", "POST", {
      workspace: "workspace",
      path: "docs/notes/todo.md",
      content: "hello mission control\n",
    })
  );
  assert.equal(writeResponse.status, 200);

  const browseResponse = await browseRoute.GET(
    new NextRequest(
      "http://localhost/api/browse?workspace=workspace&path=docs/notes/todo.md&content=true"
    )
  );
  assert.equal(browseResponse.status, 200);
  const browsePayload = (await browseResponse.json()) as { content: string };
  assert.equal(browsePayload.content, "hello mission control\n");

  const deleteResponse = await deleteRoute.DELETE(
    jsonRequest("http://localhost/api/files/delete", "DELETE", {
      workspace: "workspace",
      path: "docs/notes/todo.md",
    })
  );
  assert.equal(deleteResponse.status, 200);

  const missingResponse = await runWithMutedConsoleErrors(() =>
    browseRoute.GET(
      new NextRequest(
        "http://localhost/api/browse?workspace=workspace&path=docs/notes/todo.md&content=true"
      )
    )
  );
  assert.equal(missingResponse.status, 404);
  const missingPayload = (await missingResponse.json()) as { code: string };
  assert.equal(missingPayload.code, "path_not_found");
});

test("memory facade only allows root memory docs and memory markdown files", async () => {
  const treeResponse = await filesRoute.GET(
    new NextRequest("http://localhost/api/files?workspace=workspace")
  );
  assert.equal(treeResponse.status, 200);
  const tree = (await treeResponse.json()) as Array<{
    name: string;
    path: string;
    type: "file" | "folder";
    children?: Array<{ path: string; type: "file" | "folder"; children?: unknown[] }>;
  }>;

  assert.ok(tree.some((node) => node.path === "MEMORY.md"));
  const memoryFolder = tree.find((node) => node.path === "memory");
  assert.ok(memoryFolder);
  assert.ok(
    JSON.stringify(memoryFolder).includes("memory/journal/today.md"),
    "nested markdown files should remain visible inside memory/"
  );

  const allowedResponse = await filesRoute.GET(
    new NextRequest("http://localhost/api/files?workspace=workspace&path=memory/journal/today.md")
  );
  assert.equal(allowedResponse.status, 200);
  const allowedPayload = (await allowedResponse.json()) as { content: string };
  assert.equal(allowedPayload.content, "## today\n");

  const blockedResponse = await runWithMutedConsoleErrors(() =>
    filesRoute.GET(new NextRequest("http://localhost/api/files?workspace=workspace&path=notes.txt"))
  );
  assert.equal(blockedResponse.status, 400);
  const blockedPayload = (await blockedResponse.json()) as { code: string };
  assert.equal(blockedPayload.code, "invalid_path");
});

test("protected deletes and path conflicts return stable file-system codes", async () => {
  const protectedDeleteResponse = await runWithMutedConsoleErrors(() =>
    deleteRoute.DELETE(
      jsonRequest("http://localhost/api/files/delete", "DELETE", {
        workspace: "workspace",
        path: "MEMORY.md",
      })
    )
  );
  assert.equal(protectedDeleteResponse.status, 403);
  const protectedDeletePayload = (await protectedDeleteResponse.json()) as { code: string };
  assert.equal(protectedDeletePayload.code, "protected_path");

  const conflictResponse = await runWithMutedConsoleErrors(() =>
    mkdirRoute.POST(
      jsonRequest("http://localhost/api/files/mkdir", "POST", {
        workspace: "workspace",
        path: "",
        name: "notes.txt",
      })
    )
  );
  assert.equal(conflictResponse.status, 409);
  const conflictPayload = (await conflictResponse.json()) as { code: string };
  assert.equal(conflictPayload.code, "path_conflict");

  const invalidNameResponse = await runWithMutedConsoleErrors(() =>
    mkdirRoute.POST(
      jsonRequest("http://localhost/api/files/mkdir", "POST", {
        workspace: "workspace",
        path: "",
        name: "../bad-name",
      })
    )
  );
  assert.equal(invalidNameResponse.status, 400);
  const invalidNamePayload = (await invalidNameResponse.json()) as { code: string };
  assert.equal(invalidNamePayload.code, "invalid_path");
});

test("upload and download use the same canonical workspace paths", async () => {
  const formData = new FormData();
  formData.append("workspace", "workspace");
  formData.append("path", "uploads");
  formData.append("files", new File(["upload body"], "uploaded.txt", { type: "text/plain" }));

  const uploadResponse = await uploadRoute.POST(
    new NextRequest("http://localhost/api/files/upload", {
      method: "POST",
      body: formData,
    })
  );
  assert.equal(uploadResponse.status, 200);

  const uploadPayload = (await uploadResponse.json()) as {
    path: string;
    files: Array<{ path: string; name: string }>;
  };
  assert.equal(uploadPayload.path, "uploads");
  assert.equal(uploadPayload.files[0]?.path, "uploads/uploaded.txt");

  const downloadResponse = await downloadRoute.GET(
    new NextRequest("http://localhost/api/files/download?workspace=workspace&path=uploads/uploaded.txt")
  );
  assert.equal(downloadResponse.status, 200);
  assert.equal(downloadResponse.headers.get("Content-Disposition"), 'attachment; filename="uploaded.txt"');
  assert.equal(await downloadResponse.text(), "upload body");
});
