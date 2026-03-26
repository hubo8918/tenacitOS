import { promises as fs } from "fs";
import path from "path";

import { logActivity } from "@/lib/activities-db";
import {
  getWorkspaceBase,
  listWorkspaceDescriptors,
  resolveWorkspaceFilePath,
  type ResolvedWorkspacePath,
  type WorkspaceDescriptor,
} from "@/lib/workspace-files";

export type FileOperationErrorCode =
  | "workspace_not_found"
  | "invalid_path"
  | "path_not_found"
  | "not_a_directory"
  | "protected_path"
  | "path_conflict"
  | "write_denied"
  | "unknown_error";

export interface DirectoryEntry {
  name: string;
  type: "file" | "folder";
  size: number;
  modified: string;
}

export interface MemoryFileNode {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: MemoryFileNode[];
}

export interface FilePayload {
  name: string;
  path: string;
  workspace: string;
  size: number;
  modified: string;
  content: string;
}

export interface DownloadPayload {
  content: Buffer;
  filename: string;
  mimeType: string;
  size: number;
  workspace: string;
  path: string;
}

export interface UploadedFileResult {
  name: string;
  size: number;
  path: string;
}

const MEMORY_ROOT_FILES = ["MEMORY.md", "SOUL.md", "USER.md", "AGENTS.md", "TOOLS.md", "IDENTITY.md"];
const MEMORY_DIR = "memory";
const PROTECTED_ROOT_FILES = new Set([
  "MEMORY.md",
  "SOUL.md",
  "USER.md",
  "AGENTS.md",
  "TOOLS.md",
  "IDENTITY.md",
  "package.json",
  "tsconfig.json",
  ".env",
  ".env.local",
]);

const MIME_TYPES: Record<string, string> = {
  ".ts": "text/plain",
  ".tsx": "text/plain",
  ".js": "text/javascript",
  ".jsx": "text/javascript",
  ".json": "application/json",
  ".md": "text/markdown",
  ".txt": "text/plain",
  ".log": "text/plain",
  ".py": "text/plain",
  ".sh": "text/plain",
  ".yaml": "text/yaml",
  ".yml": "text/yaml",
  ".toml": "text/plain",
  ".css": "text/css",
  ".html": "text/html",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".zip": "application/zip",
};

export class FileSystemError extends Error {
  code: FileOperationErrorCode;
  status: number;

  constructor(code: FileOperationErrorCode, message: string, status: number) {
    super(message);
    this.name = "FileSystemError";
    this.code = code;
    this.status = status;
  }
}

export function isFileSystemError(error: unknown): error is FileSystemError {
  return error instanceof FileSystemError;
}

export function toFileSystemErrorResponse(
  error: unknown,
  fallbackMessage: string
): { error: string; code: FileOperationErrorCode; status: number } {
  if (isFileSystemError(error)) {
    return {
      error: error.message,
      code: error.code,
      status: error.status,
    };
  }

  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  if (code === "EACCES" || code === "EPERM") {
    return {
      error: "Mission Control cannot write to that location.",
      code: "write_denied",
      status: 403,
    };
  }

  return {
    error: fallbackMessage,
    code: "unknown_error",
    status: 500,
  };
}

function ensureWorkspace(workspace: string): { workspace: string; base: string } {
  const entry = getWorkspaceBase(workspace);
  if (!entry) {
    throw new FileSystemError("workspace_not_found", "Workspace not found.", 404);
  }
  return entry;
}

async function ensurePathExists(targetPath: string): Promise<void> {
  try {
    await fs.access(targetPath);
  } catch {
    throw new FileSystemError("path_not_found", "Path not found.", 404);
  }
}

function ensureResolvedPath(workspace: string, filePath?: string | null): ResolvedWorkspacePath {
  const resolved = resolveWorkspaceFilePath({ workspace, filePath });
  if (!resolved) {
    throw new FileSystemError(
      "invalid_path",
      "Invalid path. Path must stay inside the selected workspace.",
      400
    );
  }
  return resolved;
}

function isProtectedPath(relativePath: string): boolean {
  const normalized = relativePath.replace(/[\\/]+/g, "/").replace(/^\/+/, "");
  if (!normalized) return false;
  if (normalized.includes("/")) return false;
  return PROTECTED_ROOT_FILES.has(normalized);
}

function getMimeType(filename: string): string {
  return MIME_TYPES[path.extname(filename).toLowerCase()] || "application/octet-stream";
}

function isSinglePathSegment(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "." || trimmed === "..") return false;
  return !/[\\/]/.test(trimmed);
}

function ensureMemoryPathAllowed(relativePath: string): void {
  const normalized = relativePath.replace(/[\\/]+/g, "/");
  if (MEMORY_ROOT_FILES.includes(normalized)) return;
  if (normalized.startsWith(`${MEMORY_DIR}/`) && normalized.endsWith(".md")) return;

  throw new FileSystemError(
    "invalid_path",
    "Memory routes only allow root memory docs and markdown files inside memory/.",
    400
  );
}

async function readOptionalStats(targetPath: string): Promise<Awaited<ReturnType<typeof fs.stat>> | null> {
  try {
    return await fs.stat(targetPath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function buildMemoryFolderNode(
  fullPath: string,
  relativePath: string
): Promise<MemoryFileNode | null> {
  const entries = await fs.readdir(fullPath, { withFileTypes: true });
  const children: MemoryFileNode[] = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const childRelativePath = `${relativePath}/${entry.name}`;
    const childFullPath = path.join(fullPath, entry.name);

    if (entry.isDirectory()) {
      const nestedFolder = await buildMemoryFolderNode(childFullPath, childRelativePath);
      if (nestedFolder) {
        children.push(nestedFolder);
      }
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".md")) {
      children.push({
        name: entry.name,
        path: childRelativePath,
        type: "file",
      });
    }
  }

  if (children.length === 0) {
    return null;
  }

  return {
    name: path.basename(fullPath),
    path: relativePath,
    type: "folder",
    children,
  };
}

export function listWorkspaces(): WorkspaceDescriptor[] {
  return listWorkspaceDescriptors();
}

export async function listDirectory(options: {
  workspace: string;
  path?: string | null;
  includeHidden?: boolean;
}): Promise<{ workspace: string; path: string; items: DirectoryEntry[] }> {
  ensureWorkspace(options.workspace);
  const resolved = ensureResolvedPath(options.workspace, options.path);
  await ensurePathExists(resolved.fullPath);

  const stats = await fs.stat(resolved.fullPath);
  if (!stats.isDirectory()) {
    throw new FileSystemError("not_a_directory", "Target path must be a directory.", 400);
  }

  const entries = await fs.readdir(resolved.fullPath, { withFileTypes: true });
  const items = await Promise.all(
    entries
      .filter((entry) => (options.includeHidden ? true : !entry.name.startsWith(".")))
      .map(async (entry) => {
        const entryPath = path.join(resolved.fullPath, entry.name);
        const entryStats = await fs.stat(entryPath);
        return {
          name: entry.name,
          type: entry.isDirectory() ? "folder" : "file",
          size: entryStats.size,
          modified: entryStats.mtime.toISOString(),
        } as DirectoryEntry;
      })
  );

  items.sort((left, right) => {
    if (left.type !== right.type) return left.type === "folder" ? -1 : 1;
    return left.name.localeCompare(right.name);
  });

  return {
    workspace: resolved.workspace,
    path: resolved.relativePath,
    items,
  };
}

export async function readFileContent(options: {
  workspace: string;
  path: string;
}): Promise<FilePayload> {
  ensureWorkspace(options.workspace);
  const resolved = ensureResolvedPath(options.workspace, options.path);
  await ensurePathExists(resolved.fullPath);

  const stats = await fs.stat(resolved.fullPath);
  if (!stats.isFile()) {
    throw new FileSystemError("invalid_path", "Target path must be a file.", 400);
  }

  const content = await fs.readFile(resolved.fullPath, "utf-8");
  return {
    name: path.basename(resolved.fullPath),
    path: resolved.relativePath,
    workspace: resolved.workspace,
    content,
    size: stats.size,
    modified: stats.mtime.toISOString(),
  };
}

export async function writeFileContent(options: {
  workspace: string;
  path: string;
  content: string;
}): Promise<{ workspace: string; path: string; size: number }> {
  ensureWorkspace(options.workspace);
  const resolved = ensureResolvedPath(options.workspace, options.path);
  const existing = await readOptionalStats(resolved.fullPath);
  if (existing?.isDirectory()) {
    throw new FileSystemError(
      "path_conflict",
      "Cannot write a file over an existing folder.",
      409
    );
  }

  await fs.mkdir(path.dirname(resolved.fullPath), { recursive: true });
  await fs.writeFile(resolved.fullPath, options.content, "utf-8");

  const stat = await fs.stat(resolved.fullPath);
  logActivity("file_write", `Edited file: ${resolved.relativePath || options.path}`, "success", {
    metadata: {
      workspace: resolved.workspace,
      filePath: resolved.relativePath || options.path,
      size: stat.size,
    },
  });

  return {
    workspace: resolved.workspace,
    path: resolved.relativePath || options.path,
    size: stat.size,
  };
}

export async function createDirectory(options: {
  workspace: string;
  path?: string | null;
  name?: string | null;
}): Promise<{ workspace: string; path: string }> {
  ensureWorkspace(options.workspace);
  if (options.name && !isSinglePathSegment(options.name)) {
    throw new FileSystemError(
      "invalid_path",
      "Folder name must be a single path segment without slashes.",
      400
    );
  }
  const combinedPath = options.name
    ? [options.path || "", options.name].filter(Boolean).join("/")
    : options.path || "";

  const resolved = ensureResolvedPath(options.workspace, combinedPath);
  const existing = await readOptionalStats(resolved.fullPath);
  if (existing?.isFile()) {
    throw new FileSystemError(
      "path_conflict",
      "Cannot create a folder where a file already exists.",
      409
    );
  }
  await fs.mkdir(resolved.fullPath, { recursive: true });

  return {
    workspace: resolved.workspace,
    path: resolved.relativePath,
  };
}

export async function deleteEntry(options: {
  workspace: string;
  path: string;
}): Promise<{ workspace: string; path: string; type: "file" | "folder" }> {
  ensureWorkspace(options.workspace);
  const resolved = ensureResolvedPath(options.workspace, options.path);
  await ensurePathExists(resolved.fullPath);

  if (isProtectedPath(resolved.relativePath)) {
    throw new FileSystemError(
      "protected_path",
      `Cannot delete protected file: ${path.basename(resolved.relativePath)}`,
      403
    );
  }

  const stat = await fs.stat(resolved.fullPath);
  if (stat.isDirectory()) {
    await fs.rm(resolved.fullPath, { recursive: true });
  } else {
    await fs.unlink(resolved.fullPath);
  }

  const type = stat.isDirectory() ? "folder" : "file";
  logActivity("file_write", `Deleted ${type}: ${resolved.relativePath || options.path}`, "success", {
    metadata: { workspace: resolved.workspace, filePath: resolved.relativePath || options.path },
  });

  return {
    workspace: resolved.workspace,
    path: resolved.relativePath || options.path,
    type,
  };
}

export async function downloadFile(options: {
  workspace: string;
  path: string;
}): Promise<DownloadPayload> {
  ensureWorkspace(options.workspace);
  const resolved = ensureResolvedPath(options.workspace, options.path);
  await ensurePathExists(resolved.fullPath);

  const stat = await fs.stat(resolved.fullPath);
  if (!stat.isFile()) {
    throw new FileSystemError("invalid_path", "Target path must be a file.", 400);
  }

  const content = await fs.readFile(resolved.fullPath);
  const filename = path.basename(resolved.fullPath);

  logActivity("file_read", `Downloaded file: ${resolved.relativePath || options.path}`, "success", {
    metadata: {
      workspace: resolved.workspace,
      filePath: resolved.relativePath || options.path,
      size: stat.size,
    },
  });

  return {
    content,
    filename,
    mimeType: getMimeType(filename),
    size: stat.size,
    workspace: resolved.workspace,
    path: resolved.relativePath || options.path,
  };
}

export async function uploadFiles(options: {
  workspace: string;
  path?: string | null;
  files: File[];
}): Promise<{ workspace: string; path: string; files: UploadedFileResult[] }> {
  ensureWorkspace(options.workspace);
  const resolvedDir = ensureResolvedPath(options.workspace, options.path || "");

  try {
    const stats = await fs.stat(resolvedDir.fullPath);
    if (!stats.isDirectory()) {
      throw new FileSystemError("not_a_directory", "Upload target must be a folder.", 400);
    }
  } catch (error) {
    if (isFileSystemError(error)) {
      throw error;
    }
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      throw error;
    }
    await fs.mkdir(resolvedDir.fullPath, { recursive: true });
  }

  const results: UploadedFileResult[] = [];
  for (const file of options.files) {
    const sanitizedName = path.basename(file.name);
    if (!sanitizedName) {
      throw new FileSystemError("invalid_path", "Upload failed: one of the files has no name.", 400);
    }

    const targetPath = path.join(resolvedDir.fullPath, sanitizedName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(targetPath, buffer);
    results.push({
      name: sanitizedName,
      size: buffer.length,
      path: resolvedDir.relativePath ? `${resolvedDir.relativePath}/${sanitizedName}` : sanitizedName,
    });
  }

  logActivity(
    "file_write",
    `Uploaded ${results.length} file(s) to ${resolvedDir.workspace}/${resolvedDir.relativePath || "/"}`,
    "success",
    {
      metadata: {
        files: results.map((result) => result.name),
        workspace: resolvedDir.workspace,
        dirPath: resolvedDir.relativePath,
      },
    }
  );

  return {
    workspace: resolvedDir.workspace,
    path: resolvedDir.relativePath,
    files: results,
  };
}

export async function listMemoryTree(workspace: string): Promise<MemoryFileNode[]> {
  ensureWorkspace(workspace);
  const workspaceEntry = getWorkspaceBase(workspace);
  if (!workspaceEntry) {
    throw new FileSystemError("workspace_not_found", "Workspace not found.", 404);
  }

  const tree: MemoryFileNode[] = [];
  for (const file of MEMORY_ROOT_FILES) {
    const fullPath = path.join(workspaceEntry.base, file);
    try {
      const stat = await fs.stat(fullPath);
      if (stat.isFile()) {
        tree.push({
          name: file,
          path: file,
          type: "file",
        });
      }
    } catch {}
  }

  const memoryPath = path.join(workspaceEntry.base, MEMORY_DIR);
  try {
    const memoryStat = await fs.stat(memoryPath);
    if (memoryStat.isDirectory()) {
      const memoryTree = await buildMemoryFolderNode(memoryPath, MEMORY_DIR);
      if (memoryTree) {
        tree.push(memoryTree);
      }
    }
  } catch {}

  return tree;
}

export async function readMemoryFile(options: {
  workspace: string;
  path: string;
}): Promise<{ path: string; content: string }> {
  const payload = await readFileContent(options);
  ensureMemoryPathAllowed(payload.path);
  return {
    path: payload.path,
    content: payload.content,
  };
}

export async function writeMemoryFile(options: {
  workspace: string;
  path: string;
  content: string;
}): Promise<{ path: string }> {
  const resolved = ensureResolvedPath(options.workspace, options.path);
  ensureMemoryPathAllowed(resolved.relativePath);
  const result = await writeFileContent(options);
  return { path: result.path };
}
