"use client";

import { useEffect, useState } from "react";
import { Grid3X3, List } from "lucide-react";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FileBrowser } from "@/components/FileBrowser";
import { loadWorkspaces } from "@/lib/files-client";
import type { WorkspaceDescriptor } from "@/lib/workspace-files";

type PendingNavigation =
  | { kind: "workspace"; workspaceId: string }
  | { kind: "path"; path: string }
  | null;

export default function FilesPage() {
  const [workspaces, setWorkspaces] = useState<WorkspaceDescriptor[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [pageError, setPageError] = useState<string | null>(null);
  const [browserHasUnsavedChanges, setBrowserHasUnsavedChanges] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<PendingNavigation>(null);

  useEffect(() => {
    loadWorkspaces()
      .then((nextWorkspaces) => {
        setWorkspaces(nextWorkspaces);
        if (nextWorkspaces.length > 0) {
          setSelectedWorkspace((current) => current || nextWorkspaces[0].id);
        }
        setPageError(null);
      })
      .catch((error) => {
        setWorkspaces([]);
        setPageError(error instanceof Error ? error.message : "Failed to load workspaces.");
      });
  }, []);

  const selectedWorkspaceData = workspaces.find((workspace) => workspace.id === selectedWorkspace);

  const applyNavigation = (next: Exclude<PendingNavigation, null>) => {
    if (next.kind === "workspace") {
      setSelectedWorkspace(next.workspaceId);
      setCurrentPath("");
      return;
    }

    setCurrentPath(next.path);
  };

  const requestNavigation = (next: Exclude<PendingNavigation, null>) => {
    if (browserHasUnsavedChanges) {
      setPendingNavigation(next);
      return;
    }

    applyNavigation(next);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: "0" }}>
      <div style={{ padding: "24px 24px 16px 24px" }}>
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
          File Browser
        </h1>
        <p style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "var(--text-secondary)" }}>
          Browse workspace files, preview content, and make safe edits without leaving Mission Control.
        </p>
      </div>

      {pageError && (
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
          {pageError}
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
                onClick={() => requestNavigation({ kind: "workspace", workspaceId: workspace.id })}
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

        <main style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
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
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Breadcrumbs
                    path={currentPath}
                    onNavigate={(nextPath) => requestNavigation({ kind: "path", path: nextPath })}
                    prefix={selectedWorkspaceData.name}
                  />
                </div>

                <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => setViewMode("list")}
                    title="List view"
                    style={{
                      padding: "5px 7px",
                      borderRadius: "6px",
                      border: "none",
                      cursor: "pointer",
                      backgroundColor: viewMode === "list" ? "var(--accent)" : "transparent",
                      color: viewMode === "list" ? "var(--bg, #111)" : "var(--text-muted)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 120ms ease",
                    }}
                  >
                    <List size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("grid")}
                    title="Grid view"
                    style={{
                      padding: "5px 7px",
                      borderRadius: "6px",
                      border: "none",
                      cursor: "pointer",
                      backgroundColor: viewMode === "grid" ? "var(--accent)" : "transparent",
                      color: viewMode === "grid" ? "var(--bg, #111)" : "var(--text-muted)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 120ms ease",
                    }}
                  >
                    <Grid3X3 size={15} />
                  </button>
                </div>
              </div>

              <div style={{ flex: 1, padding: "0" }}>
                <FileBrowser
                  workspace={selectedWorkspace}
                  path={currentPath}
                  onNavigate={(nextPath) => requestNavigation({ kind: "path", path: nextPath })}
                  viewMode={viewMode}
                  onUnsavedChangesChange={setBrowserHasUnsavedChanges}
                />
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
              Select a workspace to explore files.
            </div>
          )}
        </main>
      </div>

      <ConfirmDialog
        open={Boolean(pendingNavigation)}
        title="Discard unsaved editor changes?"
        description="You have unsaved file edits. Switching folders or workspaces now will discard those changes."
        confirmLabel="Discard changes"
        confirmTone="danger"
        onCancel={() => setPendingNavigation(null)}
        onConfirm={() => {
          if (pendingNavigation) {
            applyNavigation(pendingNavigation);
          }
          setPendingNavigation(null);
          setBrowserHasUnsavedChanges(false);
        }}
      />
    </div>
  );
}
