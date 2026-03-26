"use client";

import type { DirectoryEntry, FileOperationErrorCode } from "@/lib/file-system";
import type { WorkspaceDescriptor } from "@/lib/workspace-files";
import type { FileNode } from "@/components/FileTree";

export class FileClientError extends Error {
  code: FileOperationErrorCode;

  constructor(message: string, code: FileOperationErrorCode) {
    super(message);
    this.name = "FileClientError";
    this.code = code;
  }
}

interface ErrorPayload {
  error?: string;
  code?: FileOperationErrorCode;
}

interface ReadFilePayload {
  name: string;
  path: string;
  workspace: string;
  content: string;
  size: number;
  modified: string;
}

interface DirectoryPayload {
  workspace: string;
  path: string;
  items: DirectoryEntry[];
}

function buildQuery(params: Record<string, string | null | undefined>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      searchParams.set(key, value);
    }
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

async function parseResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const payload = (await response.json().catch(() => null)) as (T & ErrorPayload) | null;
  if (!response.ok) {
    throw new FileClientError(payload?.error || fallbackMessage, payload?.code || "unknown_error");
  }
  return payload as T;
}

export function getDownloadUrl(workspace: string, filePath: string): string {
  return `/api/files/download${buildQuery({ workspace, path: filePath })}`;
}

export async function loadWorkspaces(): Promise<WorkspaceDescriptor[]> {
  const response = await fetch("/api/files/workspaces");
  const payload = await parseResponse<{ workspaces: WorkspaceDescriptor[] }>(
    response,
    "Failed to load workspaces."
  );
  return payload.workspaces || [];
}

export async function loadDirectory(
  workspace: string,
  filePath: string
): Promise<DirectoryPayload> {
  const response = await fetch(`/api/browse${buildQuery({ workspace, path: filePath })}`);
  return parseResponse<DirectoryPayload>(response, "Failed to load directory.");
}

export async function readFile(
  workspace: string,
  filePath: string,
  source: "browse" | "memory" = "browse"
): Promise<ReadFilePayload | { path: string; content: string }> {
  const route =
    source === "memory"
      ? `/api/files${buildQuery({ workspace, path: filePath })}`
      : `/api/browse${buildQuery({ workspace, path: filePath, content: "true" })}`;

  const response = await fetch(route);
  return parseResponse<ReadFilePayload | { path: string; content: string }>(
    response,
    "Failed to load file."
  );
}

export async function loadMemoryTree(workspace: string): Promise<FileNode[]> {
  const response = await fetch(`/api/files${buildQuery({ workspace })}`);
  return parseResponse<FileNode[]>(response, "Failed to load memory files.");
}

export async function saveFile(
  workspace: string,
  filePath: string,
  content: string,
  source: "browse" | "memory" = "browse"
): Promise<void> {
  const route = source === "memory" ? "/api/files" : "/api/files/write";
  const method = source === "memory" ? "PUT" : "POST";
  const response = await fetch(route, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspace, path: filePath, content }),
  });
  await parseResponse<{ success: true }>(response, "Failed to save file.");
}

export async function deleteEntry(workspace: string, filePath: string): Promise<void> {
  const response = await fetch("/api/files/delete", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspace, path: filePath }),
  });
  await parseResponse<{ success: true }>(response, "Delete failed.");
}

export async function createFolder(
  workspace: string,
  currentPath: string,
  name: string
): Promise<void> {
  const response = await fetch("/api/files/mkdir", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspace, path: currentPath, name }),
  });
  await parseResponse<{ success: true }>(response, "Failed to create folder.");
}

export async function uploadFiles(
  workspace: string,
  currentPath: string,
  files: File[]
): Promise<void> {
  const formData = new FormData();
  formData.append("workspace", workspace);
  formData.append("path", currentPath);
  for (const file of files) {
    formData.append("files", file);
  }

  const response = await fetch("/api/files/upload", {
    method: "POST",
    body: formData,
  });
  await parseResponse<{ success: true }>(response, "Upload failed.");
}
