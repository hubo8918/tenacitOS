"use client";

import { useCallback, useEffect, useState } from "react";
import { Brain, Edit3, Eye, RefreshCw } from "lucide-react";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FileTree, type FileNode } from "@/components/FileTree";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { MarkdownPreview } from "@/components/MarkdownPreview";
import {
  loadMemoryTree,
  loadWorkspaces,
  readFile,
  saveFile,
} from "@/lib/files-client";
import type { WorkspaceDescriptor } from "@/lib/workspace-files";

type ViewMode = "edit" | "preview";
type PendingSelection =
  | { kind: "workspace"; workspaceId: string }
  | { kind: "file"; path: string }
  | null;

function findFirstFile(nodes: FileNode[]): FileNode | null {
  for (const node of nodes) {
    if (node.type === "file") return node;
    if (node.children?.length) {
      const nested = findFirstFile(node.children);
      if (nested) return nested;
    }
  }
  return null;
}

export default function MemoryPage() {
  const [workspaces, setWorkspaces] = useState<WorkspaceDescriptor[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(null);
  const [files, setFiles] = useState<FileNode[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("preview");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingSelection, setPendingSelection] = useState<PendingSelection>(null);

  const hasUnsavedChanges = content !== originalContent;
  const selectedWorkspaceData = workspaces.find((workspace) => workspace.id === selectedWorkspace);

  useEffect(() => {
    loadWorkspaces()
      .then((nextWorkspaces) => {
        setWorkspaces(nextWorkspaces);
        if (nextWorkspaces.length > 0) {
          setSelectedWorkspace((current) => current || nextWorkspaces[0].id);
        }
        setError(null);
      })
      .catch((loadError) => {
        setWorkspaces([]);
        setError(loadError instanceof Error ? loadError.message : "Failed to load workspaces.");
      });
  }, []);

  const loadFileTree = useCallback(async (workspace: string) => {
    try {
      setIsLoading(true);
      const nextFiles = await loadMemoryTree(workspace);
      setFiles(nextFiles);
      setError(null);
    } catch (loadError) {
      setFiles([]);
      setError(loadError instanceof Error ? loadError.message : "Failed to load memory files.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadMemoryFile = useCallback(async (workspace: string, filePath: string) => {
    try {
      const payload = await readFile(workspace, filePath, "memory");
      if (!("content" in payload)) {
        throw new Error("Failed to load file.");
      }
      setContent(payload.content);
      setOriginalContent(payload.content);
      setSelectedPath(filePath);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load file.");
    }
  }, []);

  const saveMemoryFile = useCallback(async () => {
    if (!selectedWorkspace || !selectedPath) return;

    setIsSaving(true);
    try {
      await saveFile(selectedWorkspace, selectedPath, content, "memory");
      setOriginalContent(content);
      setError(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save file.");
      throw saveError;
    } finally {
      setIsSaving(false);
    }
  }, [content, selectedPath, selectedWorkspace]);

  const applySelection = useCallback(
    async (next: Exclude<PendingSelection, null>) => {
      if (next.kind === "workspace") {
        setSelectedWorkspace(next.workspaceId);
        setSelectedPath(null);
        setContent("");
        setOriginalContent("");
        return;
      }

      if (selectedWorkspace) {
        await loadMemoryFile(selectedWorkspace, next.path);
      }
    },
    [loadMemoryFile, selectedWorkspace]
  );

  const requestSelection = useCallback(
    async (next: Exclude<PendingSelection, null>) => {
      if (hasUnsavedChanges) {
        setPendingSelection(next);
        return;
      }

      await applySelection(next);
    },
    [applySelection, hasUnsavedChanges]
  );

  useEffect(() => {
    if (selectedWorkspace) {
      void loadFileTree(selectedWorkspace);
    }
  }, [selectedWorkspace, loadFileTree]);

  useEffect(() => {
    if (files.length === 0 || selectedPath) return;

    const memoryMd = files.find((file) => file.name === "MEMORY.md" && file.type === "file");
    const firstFile = memoryMd || findFirstFile(files);
    if (firstFile) {
      void requestSelection({ kind: "file", path: firstFile.path });
    }
  }, [files, requestSelection, selectedPath]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "24px 24px 16px 24px", flexShrink: 0 }}>
        <h1
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "24px",
            fontWeight: 700,
            letterSpacing: "-1px",
            color: "var(--text-primary)",
            marginBottom: "4px",
          }}
        >
          Memory Browser
        </h1>
        <p style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "var(--text-secondary)" }}>
          Review and edit agent memory documents with the same workspace registry and safety rules as Files.
        </p>
      </div>

      {error && (
        <div
          style={{
            margin: "0 24px 16px",
            padding: "12px 14px",
            borderRadius: "12px",
            border: "1px solid color-mix(in srgb, var(--status-blocked) 35%, var(--border))",
            backgroundColor: "color-mix(in srgb, var(--status-blocked) 10%, transparent)",
            color: "var(--status-blocked)",
            fontSize: "13px",
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          display: "flex",
          flex: 1,
          overflow: "hidden",
          borderTop: "1px solid var(--border)",
        }}
      >
        <aside
          style={{
            width: "220px",
            flexShrink: 0,
            borderRight: "1px solid var(--border)",
            overflowY: "auto",
            padding: "16px 0",
            backgroundColor: "var(--surface, var(--card))",
          }}
        >
          <p
            style={{
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: "var(--text-muted)",
              padding: "0 16px 8px",
              textTransform: "uppercase",
            }}
          >
            Workspaces
          </p>

          {workspaces.map((workspace) => {
            const isSelected = selectedWorkspace === workspace.id;
            return (
              <button
                key={workspace.id}
                type="button"
                onClick={() => void requestSelection({ kind: "workspace", workspaceId: workspace.id })}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "9px 16px",
                  background: isSelected ? "var(--accent-soft)" : "transparent",
                  border: "none",
                  borderLeft: isSelected ? "3px solid var(--accent)" : "3px solid transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 120ms ease",
                }}
                onMouseEnter={(event) => {
                  if (!isSelected) event.currentTarget.style.background = "var(--surface-hover, rgba(255,255,255,0.05))";
                }}
                onMouseLeave={(event) => {
                  if (!isSelected) event.currentTarget.style.background = "transparent";
                }}
              >
                <span style={{ fontSize: "18px", lineHeight: 1, flexShrink: 0 }}>{workspace.emoji}</span>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontSize: "13px",
                      fontWeight: isSelected ? 600 : 400,
                      color: isSelected ? "var(--accent)" : "var(--text-primary)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {workspace.name}
                  </div>
                  {workspace.agentName && (
                    <div
                      style={{
                        fontSize: "11px",
                        color: "var(--text-muted)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {workspace.agentName}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </aside>

        <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {selectedWorkspace && selectedWorkspaceData ? (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 16px",
                  borderBottom: "1px solid var(--border)",
                  backgroundColor: "var(--surface, var(--card))",
                  flexShrink: 0,
                  gap: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Brain style={{ width: "16px", height: "16px", color: "var(--accent)" }} />
                  <span
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                    }}
                  >
                    {selectedWorkspaceData.name}
                  </span>
                  {selectedPath && (
                    <>
                      <span style={{ color: "var(--text-muted)", fontSize: "13px" }}>/</span>
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "12px",
                          color: "var(--text-muted)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: "300px",
                        }}
                      >
                        {selectedPath}
                      </span>
                    </>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => selectedWorkspace && void loadFileTree(selectedWorkspace)}
                    title="Refresh"
                    style={{
                      padding: "5px 7px",
                      borderRadius: "6px",
                      backgroundColor: "transparent",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--text-muted)",
                      display: "flex",
                      alignItems: "center",
                      transition: "all 120ms ease",
                    }}
                    onMouseEnter={(event) => {
                      event.currentTarget.style.color = "var(--text-primary)";
                    }}
                    onMouseLeave={(event) => {
                      event.currentTarget.style.color = "var(--text-muted)";
                    }}
                  >
                    <RefreshCw size={14} />
                  </button>

                  <div
                    style={{
                      display: "flex",
                      backgroundColor: "var(--bg)",
                      borderRadius: "6px",
                      padding: "3px",
                      gap: "2px",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setViewMode("preview")}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "5px",
                        padding: "5px 10px",
                        borderRadius: "4px",
                        backgroundColor: viewMode === "preview" ? "var(--accent)" : "transparent",
                        color: viewMode === "preview" ? "var(--bg, #111)" : "var(--text-muted)",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "12px",
                        fontWeight: 600,
                        transition: "all 120ms ease",
                      }}
                    >
                      <Eye size={13} />
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("edit")}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "5px",
                        padding: "5px 10px",
                        borderRadius: "4px",
                        backgroundColor: viewMode === "edit" ? "var(--accent)" : "transparent",
                        color: viewMode === "edit" ? "var(--bg, #111)" : "var(--text-muted)",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "12px",
                        fontWeight: 600,
                        transition: "all 120ms ease",
                      }}
                    >
                      <Edit3 size={13} />
                      Edit
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
                <div
                  style={{
                    width: "230px",
                    flexShrink: 0,
                    borderRight: "1px solid var(--border)",
                    overflowY: "auto",
                  }}
                >
                  {isLoading ? (
                    <div style={{ padding: "24px", textAlign: "center", color: "var(--text-secondary)" }}>
                      Loading...
                    </div>
                  ) : (
                    <FileTree
                      files={files}
                      selectedPath={selectedPath}
                      onSelect={(path) => void requestSelection({ kind: "file", path })}
                    />
                  )}
                </div>

                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    minWidth: 0,
                    backgroundColor: "var(--bg)",
                    overflow: "hidden",
                  }}
                >
                  {selectedPath ? (
                    <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
                      {viewMode === "edit" ? (
                        <MarkdownEditor
                          content={content}
                          onChange={setContent}
                          onSave={saveMemoryFile}
                          hasUnsavedChanges={hasUnsavedChanges}
                          disabled={isSaving}
                        />
                      ) : (
                        <MarkdownPreview content={content} />
                      )}
                    </div>
                  ) : (
                    <div
                      style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--text-muted)",
                      }}
                    >
                      <div style={{ textAlign: "center" }}>
                        <Brain style={{ width: "64px", height: "64px", margin: "0 auto 16px", opacity: 0.3 }} />
                        <p style={{ fontSize: "14px" }}>Select a memory document to inspect or edit.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-muted)",
                fontSize: "14px",
              }}
            >
              Select a workspace.
            </div>
          )}
        </main>
      </div>

      <ConfirmDialog
        open={Boolean(pendingSelection)}
        title="Discard unsaved memory edits?"
        description="You have unsaved changes in the current memory document. Switching now will discard them."
        confirmLabel="Discard changes"
        confirmTone="danger"
        onCancel={() => setPendingSelection(null)}
        onConfirm={() => {
          const next = pendingSelection;
          setPendingSelection(null);
          setOriginalContent(content);
          if (next) {
            void applySelection(next);
          }
        }}
      />
    </div>
  );
}
