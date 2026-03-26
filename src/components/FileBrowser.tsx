"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import dynamic from "next/dynamic";
import {
  AlertCircle,
  Code2,
  Download,
  Eye,
  File,
  FileCode,
  FileJson,
  FilePlus,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Image,
  Loader2,
  RefreshCw,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FilePreview } from "@/components/FilePreview";
import {
  FileClientError,
  createFolder,
  deleteEntry,
  getDownloadUrl,
  loadDirectory,
  readFile,
  saveFile,
  uploadFiles,
} from "@/lib/files-client";
import type { DirectoryEntry } from "@/lib/file-system";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

interface FileBrowserProps {
  workspace: string;
  path: string;
  onNavigate: (path: string) => void;
  viewMode?: "grid" | "list";
  onUnsavedChangesChange?: (dirty: boolean) => void;
}

interface ActiveFile {
  workspace: string;
  path: string;
  name: string;
}

interface EditorModalProps {
  workspace: string;
  filePath: string;
  fileName: string;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
  onDirtyStateChange?: (dirty: boolean) => void;
}

function getFileIcon(name: string, type: DirectoryEntry["type"]) {
  if (type === "folder") return Folder;
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (["ts", "tsx", "js", "jsx", "py", "sh", "bash"].includes(ext)) return FileCode;
  if (["json", "yaml", "yml", "toml"].includes(ext)) return FileJson;
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "ico"].includes(ext)) return Image;
  if (["md", "mdx", "txt", "log"].includes(ext)) return FileText;
  return File;
}

function getFileColor(name: string, type: DirectoryEntry["type"]) {
  if (type === "folder") return "#F59E0B";
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (["ts", "tsx"].includes(ext)) return "#60A5FA";
  if (["js", "jsx"].includes(ext)) return "#FCD34D";
  if (["json"].includes(ext)) return "#4ADE80";
  if (["py"].includes(ext)) return "#93C5FD";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return "#C084FC";
  return "var(--text-secondary)";
}

function formatFileSize(bytes: number) {
  if (bytes === 0) return "-";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, index)).toFixed(index > 0 ? 1 : 0)} ${units[index]}`;
}

function getMonacoLanguage(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    json: "json",
    md: "markdown",
    mdx: "markdown",
    py: "python",
    sh: "shell",
    bash: "shell",
    yaml: "yaml",
    yml: "yaml",
    toml: "toml",
    css: "css",
    html: "html",
    sql: "sql",
    txt: "plaintext",
    log: "plaintext",
  };
  return map[ext] || "plaintext";
}

function isEditable(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  return [
    "ts",
    "tsx",
    "js",
    "jsx",
    "json",
    "md",
    "mdx",
    "txt",
    "py",
    "sh",
    "yaml",
    "yml",
    "toml",
    "css",
    "html",
    "sql",
    "log",
    "env",
  ].includes(ext) || !name.includes(".");
}

function isValidEntryName(name: string) {
  return name !== "." && name !== ".." && !/[\\/]/.test(name);
}

function getParentPath(currentPath: string) {
  const segments = currentPath.split("/").filter(Boolean);
  segments.pop();
  return segments.join("/");
}

function formatClientError(error: unknown, fallback: string) {
  if (error instanceof FileClientError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

function EditorModal({
  workspace,
  filePath,
  fileName,
  onClose,
  onSaved,
  onDirtyStateChange,
}: EditorModalProps) {
  const [content, setContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"edit" | "preview">("edit");
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);

  const hasUnsavedChanges = content !== originalContent;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setSaved(false);
    setContent("");
    setOriginalContent("");
    readFile(workspace, filePath)
      .then((data) => {
        if (!active || !("content" in data)) return;
        setContent(data.content);
        setOriginalContent(data.content);
        setLoading(false);
      })
      .catch((loadError) => {
        if (!active) return;
        setError(formatClientError(loadError, "Failed to load file."));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [filePath, workspace]);

  useEffect(() => {
    onDirtyStateChange?.(hasUnsavedChanges);
  }, [hasUnsavedChanges, onDirtyStateChange]);

  useEffect(() => () => onDirtyStateChange?.(false), [onDirtyStateChange]);

  const handleSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await saveFile(workspace, filePath, content);
      setOriginalContent(content);
      setSaved(true);
      await onSaved();
      window.setTimeout(() => setSaved(false), 1500);
    } catch (saveError) {
      setError(formatClientError(saveError, "Failed to save file."));
    } finally {
      setSaving(false);
    }
  }, [content, filePath, onSaved, saving, workspace]);

  const requestClose = useCallback(() => {
    if (hasUnsavedChanges) {
      setConfirmDiscardOpen(true);
      return;
    }
    onClose();
  }, [hasUnsavedChanges, onClose]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "s") {
        event.preventDefault();
        void handleSave();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        requestClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave, requestClose]);

  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 1000, backgroundColor: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
        <div style={{ width: "95vw", maxWidth: "1200px", height: "90vh", backgroundColor: "var(--card)", borderRadius: "1rem", border: "1px solid var(--border)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
            <FileCode className="w-5 h-5" style={{ color: "var(--accent)" }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontSize: "0.9rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{fileName}</div>
              <div style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>{filePath}</div>
            </div>
            <div style={{ display: "flex", gap: "0.25rem" }}>
              <button type="button" onClick={() => setViewMode("edit")} style={{ padding: "0.375rem 0.75rem", borderRadius: "0.375rem", fontSize: "0.75rem", backgroundColor: viewMode === "edit" ? "var(--accent)" : "var(--card-elevated)", color: viewMode === "edit" ? "#000" : "var(--text-secondary)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.25rem" }}><Code2 className="w-3.5 h-3.5" /> Edit</button>
              <button type="button" onClick={() => setViewMode("preview")} style={{ padding: "0.375rem 0.75rem", borderRadius: "0.375rem", fontSize: "0.75rem", backgroundColor: viewMode === "preview" ? "var(--accent)" : "var(--card-elevated)", color: viewMode === "preview" ? "#000" : "var(--text-secondary)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.25rem" }}><Eye className="w-3.5 h-3.5" /> Preview</button>
            </div>
            <button type="button" onClick={() => void handleSave()} disabled={saving || loading} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 1rem", borderRadius: "0.5rem", backgroundColor: saved ? "var(--success)" : "var(--accent)", color: "#000", border: "none", cursor: saving || loading ? "not-allowed" : "pointer", fontWeight: 600, fontSize: "0.875rem", opacity: saving || loading ? 0.7 : 1 }}><Save className="w-4 h-4" />{saved ? "Saved" : saving ? "Saving..." : "Save"}</button>
            <button type="button" onClick={requestClose} style={{ padding: "0.5rem", borderRadius: "0.5rem", border: "none", cursor: "pointer", backgroundColor: "var(--card-elevated)", color: "var(--text-secondary)" }}><X className="w-4 h-4" /></button>
          </div>
          {(error || hasUnsavedChanges) && <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", padding: "0.5rem 1rem", borderBottom: "1px solid var(--border)", backgroundColor: error ? "color-mix(in srgb, var(--status-blocked) 10%, transparent)" : "color-mix(in srgb, var(--accent) 8%, transparent)", color: error ? "var(--status-blocked)" : "var(--text-secondary)", fontSize: "0.85rem" }}><span>{error || "Unsaved changes. Press Ctrl/Cmd+S to save."}</span>{error && <button type="button" onClick={() => setError(null)} style={{ padding: "0.25rem", borderRadius: "0.375rem", background: "none", color: "inherit", border: "none", cursor: "pointer" }} aria-label="Dismiss editor error"><X className="w-4 h-4" /></button>}</div>}
          <div style={{ flex: 1, overflow: "hidden" }}>
            {loading ? <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}><Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--accent)" }} /></div> : viewMode === "edit" ? <MonacoEditor value={content} onChange={(value) => setContent(value || "")} language={getMonacoLanguage(fileName)} theme="vs-dark" options={{ fontSize: 14, minimap: { enabled: false }, wordWrap: "on", scrollBeyondLastLine: false, lineNumbers: "on", renderWhitespace: "selection", tabSize: 2, automaticLayout: true }} /> : <div style={{ height: "100%", overflow: "auto", padding: "1.5rem" }}><pre style={{ color: "var(--text-primary)", whiteSpace: "pre-wrap", fontFamily: "var(--font-mono)", fontSize: "0.875rem" }}>{content}</pre></div>}
          </div>
        </div>
      </div>
      <ConfirmDialog open={confirmDiscardOpen} title="Discard unsaved file edits?" description="You have unsaved changes in this editor. Closing now will discard them." confirmLabel="Discard changes" confirmTone="danger" onCancel={() => setConfirmDiscardOpen(false)} onConfirm={() => { setConfirmDiscardOpen(false); onClose(); }} />
    </>
  );
}

export function FileBrowser({ workspace, path, onNavigate, viewMode = "list", onUnsavedChangesChange }: FileBrowserProps) {
  const [items, setItems] = useState<DirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<ActiveFile | null>(null);
  const [editorFile, setEditorFile] = useState<ActiveFile | null>(null);
  const [editorDirty, setEditorDirty] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DirectoryEntry | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [showNewFile, setShowNewFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await loadDirectory(workspace, path);
      setItems(payload.items);
    } catch (loadError) {
      setItems([]);
      setError(formatClientError(loadError, "Failed to load directory."));
    } finally {
      setLoading(false);
    }
  }, [path, workspace]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  useEffect(() => {
    setPreviewFile(null);
    setEditorFile(null);
    setEditorDirty(false);
    setShowNewFile(false);
    setShowNewFolder(false);
    setNewFileName("");
    setNewFolderName("");
    setOperationError(null);
    onUnsavedChangesChange?.(false);
  }, [onUnsavedChangesChange, path, workspace]);

  useEffect(() => {
    onUnsavedChangesChange?.(editorDirty);
  }, [editorDirty, onUnsavedChangesChange]);

  const getFilePath = useCallback((name: string) => (path ? `${path}/${name}` : name), [path]);
  const handleItemClick = useCallback((item: DirectoryEntry) => {
    if (item.type === "folder") {
      onNavigate(getFilePath(item.name));
      return;
    }
    const file = { workspace, path: getFilePath(item.name), name: item.name };
    if (isEditable(item.name)) {
      setEditorFile(file);
      setPreviewFile(null);
    } else {
      setPreviewFile(file);
    }
  }, [getFilePath, onNavigate, workspace]);

  const handleUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setOperationError(null);
    try {
      await uploadFiles(workspace, path, Array.from(files));
      await loadItems();
    } catch (uploadError) {
      setOperationError(formatClientError(uploadError, "Upload failed."));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
      setUploading(false);
    }
  }, [loadItems, path, workspace]);

  const handleCreateFolder = useCallback(async () => {
    const trimmedName = newFolderName.trim();
    if (!trimmedName) return;
    if (!isValidEntryName(trimmedName)) {
      setOperationError("Use a single folder name without slashes or reserved path segments.");
      return;
    }
    setOperationError(null);
    try {
      await createFolder(workspace, path, trimmedName);
      setNewFolderName("");
      setShowNewFolder(false);
      await loadItems();
    } catch (createError) {
      setOperationError(formatClientError(createError, "Failed to create folder."));
    }
  }, [loadItems, newFolderName, path, workspace]);

  const handleCreateFile = useCallback(async () => {
    const trimmedName = newFileName.trim();
    if (!trimmedName) return;
    if (!isValidEntryName(trimmedName)) {
      setOperationError("Use a single file name without slashes or reserved path segments.");
      return;
    }
    const nextPath = getFilePath(trimmedName);
    setOperationError(null);
    try {
      await saveFile(workspace, nextPath, "");
      setNewFileName("");
      setShowNewFile(false);
      await loadItems();
      setEditorFile({ workspace, path: nextPath, name: trimmedName });
    } catch (createError) {
      setOperationError(formatClientError(createError, "Failed to create file."));
    }
  }, [getFilePath, loadItems, newFileName, workspace]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await deleteEntry(workspace, getFilePath(deleteTarget.name));
      setDeleteTarget(null);
      await loadItems();
    } catch (deleteError) {
      setDeleteTarget(null);
      setOperationError(formatClientError(deleteError, "Delete failed."));
    }
  }, [deleteTarget, getFilePath, loadItems, workspace]);

  const handleDownload = useCallback((item: DirectoryEntry) => {
    const anchor = document.createElement("a");
    anchor.href = getDownloadUrl(workspace, getFilePath(item.name));
    anchor.download = item.name;
    anchor.click();
  }, [getFilePath, workspace]);

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--accent)" }} /></div>;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center" style={{ color: "var(--text-secondary)" }}>
        <AlertCircle className="w-12 h-12 mb-4" style={{ color: "var(--status-blocked)" }} />
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Could not load {path ? `/${path}` : "/"}</p>
        <p className="mt-2 text-sm" style={{ color: "var(--text-muted)", maxWidth: "32rem", lineHeight: 1.6 }}>{error}</p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button type="button" onClick={() => void loadItems()} className="px-4 py-2 text-sm font-medium rounded-lg transition-colors" style={{ backgroundColor: "var(--surface-elevated)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>Retry</button>
          {path && <button type="button" onClick={() => onNavigate(getParentPath(path))} className="px-4 py-2 text-sm font-medium rounded-lg transition-colors" style={{ backgroundColor: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>Go up one level</button>}
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 1rem", borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} style={{ display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.375rem 0.75rem", borderRadius: "0.5rem", backgroundColor: "var(--card-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border)", cursor: uploading ? "not-allowed" : "pointer", fontSize: "0.8rem", opacity: uploading ? 0.7 : 1 }}>{uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}Upload</button>
        <input ref={fileInputRef} type="file" multiple style={{ display: "none" }} onChange={(event) => void handleUpload(event.target.files)} />
        <button type="button" onClick={() => { setShowNewFolder(true); setShowNewFile(false); setOperationError(null); }} style={{ display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.375rem 0.75rem", borderRadius: "0.5rem", backgroundColor: "var(--card-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border)", cursor: "pointer", fontSize: "0.8rem" }}><FolderPlus className="w-3.5 h-3.5" /> New Folder</button>
        <button type="button" onClick={() => { setShowNewFile(true); setShowNewFolder(false); setOperationError(null); }} style={{ display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.375rem 0.75rem", borderRadius: "0.5rem", backgroundColor: "var(--card-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border)", cursor: "pointer", fontSize: "0.8rem" }}><FilePlus className="w-3.5 h-3.5" /> New File</button>
        <button type="button" onClick={() => void loadItems()} style={{ display: "flex", alignItems: "center", padding: "0.375rem", borderRadius: "0.5rem", backgroundColor: "transparent", color: "var(--text-muted)", border: "none", cursor: "pointer", marginLeft: "auto" }}><RefreshCw className="w-3.5 h-3.5" /></button>
      </div>
      {operationError && <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)", backgroundColor: "color-mix(in srgb, var(--status-blocked) 10%, transparent)", color: "var(--status-blocked)", fontSize: "0.85rem" }}><span>{operationError}</span><button type="button" onClick={() => setOperationError(null)} style={{ padding: "0.25rem", borderRadius: "0.375rem", background: "none", color: "inherit", border: "none", cursor: "pointer" }} aria-label="Dismiss file operation error"><X className="w-4 h-4" /></button></div>}
      {showNewFolder && <div style={{ display: "flex", gap: "0.5rem", padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)", backgroundColor: "var(--card-elevated)" }}><Folder className="w-4 h-4 mt-1.5" style={{ color: "#F59E0B", flexShrink: 0 }} /><input autoFocus value={newFolderName} onChange={(event) => setNewFolderName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void handleCreateFolder(); if (event.key === "Escape") { setShowNewFolder(false); setNewFolderName(""); } }} placeholder="Folder name" style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--text-primary)", fontSize: "0.9rem" }} /><button type="button" onClick={() => void handleCreateFolder()} style={{ padding: "0.25rem 0.75rem", borderRadius: "0.375rem", background: "var(--accent)", color: "#000", border: "none", cursor: "pointer", fontSize: "0.8rem" }}>Create</button><button type="button" onClick={() => { setShowNewFolder(false); setNewFolderName(""); }} style={{ padding: "0.25rem", borderRadius: "0.375rem", background: "none", color: "var(--text-muted)", border: "none", cursor: "pointer" }}><X className="w-4 h-4" /></button></div>}
      {showNewFile && <div style={{ display: "flex", gap: "0.5rem", padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)", backgroundColor: "var(--card-elevated)" }}><File className="w-4 h-4 mt-1.5" style={{ color: "var(--text-secondary)", flexShrink: 0 }} /><input autoFocus value={newFileName} onChange={(event) => setNewFileName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void handleCreateFile(); if (event.key === "Escape") { setShowNewFile(false); setNewFileName(""); } }} placeholder="filename.ts" style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--text-primary)", fontSize: "0.9rem" }} /><button type="button" onClick={() => void handleCreateFile()} style={{ padding: "0.25rem 0.75rem", borderRadius: "0.375rem", background: "var(--accent)", color: "#000", border: "none", cursor: "pointer", fontSize: "0.8rem" }}>Create</button><button type="button" onClick={() => { setShowNewFile(false); setNewFileName(""); }} style={{ padding: "0.25rem", borderRadius: "0.375rem", background: "none", color: "var(--text-muted)", border: "none", cursor: "pointer" }}><X className="w-4 h-4" /></button></div>}
      <div onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); void handleUpload(event.dataTransfer.files); }} style={{ flex: 1, outline: dragging ? "2px dashed var(--accent)" : "none", outlineOffset: "-2px", transition: "outline 0.2s", minHeight: "100px" }}>
        {items.length === 0 && !dragging && <div className="flex flex-col items-center justify-center py-12" style={{ color: "var(--text-secondary)" }}><FolderOpen className="w-16 h-16 mb-4 opacity-50" /><p>This folder is empty.</p><p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>Drag and drop files here to upload.</p></div>}
        {dragging && <div className="flex flex-col items-center justify-center py-12" style={{ color: "var(--accent)" }}><Upload className="w-16 h-16 mb-4" /><p>Drop files to upload.</p></div>}
        {viewMode === "list" && items.length > 0 && !dragging && <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--card)" }}><div className="hidden md:grid grid-cols-12 gap-4 px-4 md:px-6 py-2 md:py-3 text-xs md:text-sm font-medium" style={{ backgroundColor: "var(--background)", color: "var(--text-secondary)" }}><div className="col-span-6">Name</div><div className="col-span-2">Size</div><div className="col-span-3">Modified</div><div className="col-span-1"></div></div>{items.map((item) => { const Icon = getFileIcon(item.name, item.type); const iconColor = getFileColor(item.name, item.type); return <div key={item.name} className="flex md:grid md:grid-cols-12 gap-2 md:gap-4 px-3 md:px-6 py-2.5 md:py-3 cursor-pointer transition-colors hover:opacity-80 group" style={{ borderBottom: "1px solid var(--border)", position: "relative" }} onMouseEnter={(event) => { event.currentTarget.style.backgroundColor = "var(--background)"; }} onMouseLeave={(event) => { event.currentTarget.style.backgroundColor = "transparent"; }}><div className="md:col-span-6 flex items-center gap-2 md:gap-3 min-w-0 flex-1" onClick={() => handleItemClick(item)}><Icon className="w-4 h-4 md:w-5 md:h-5 shrink-0" style={{ color: iconColor }} /><span className="truncate text-sm md:text-base" style={{ color: "var(--text-primary)" }}>{item.name}</span>{isEditable(item.name) && item.type === "file" && <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", opacity: 0 }} className="group-hover:opacity-100">edit</span>}</div><div className="md:col-span-2 text-xs md:text-sm flex items-center" style={{ color: "var(--text-secondary)" }} onClick={() => handleItemClick(item)}>{item.type === "folder" ? "-" : formatFileSize(item.size)}</div><div className="hidden md:col-span-3 md:text-sm md:flex items-center" style={{ color: "var(--text-secondary)" }} onClick={() => handleItemClick(item)}>{format(new Date(item.modified), "MMM d, yyyy HH:mm")}</div><div className="md:col-span-1 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">{item.type === "file" && <button type="button" onClick={(event) => { event.stopPropagation(); handleDownload(item); }} style={{ padding: "0.25rem", borderRadius: "0.25rem", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><Download className="w-3.5 h-3.5" /></button>}<button type="button" onClick={(event) => { event.stopPropagation(); setDeleteTarget(item); }} style={{ padding: "0.25rem", borderRadius: "0.25rem", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><Trash2 className="w-3.5 h-3.5" /></button></div></div>; })}</div>}
        {viewMode === "grid" && items.length > 0 && !dragging && <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-4 p-4">{items.map((item) => { const Icon = getFileIcon(item.name, item.type); const iconColor = getFileColor(item.name, item.type); return <div key={item.name} onClick={() => handleItemClick(item)} className="flex flex-col items-center p-3 md:p-4 rounded-xl cursor-pointer transition-all group relative" style={{ backgroundColor: "var(--card)" }} onMouseEnter={(event) => { event.currentTarget.style.backgroundColor = "var(--background)"; }} onMouseLeave={(event) => { event.currentTarget.style.backgroundColor = "var(--card)"; }}><Icon className="w-10 h-10 md:w-12 md:h-12 mb-2 md:mb-3 group-hover:scale-110 transition-transform" style={{ color: iconColor }} /><span className="text-xs md:text-sm text-center truncate w-full" style={{ color: "var(--text-primary)" }} title={item.name}>{item.name}</span><span className="text-[10px] md:text-xs mt-0.5 md:mt-1" style={{ color: "var(--text-muted)" }}>{item.type === "folder" ? "Folder" : formatFileSize(item.size)}</span><div style={{ position: "absolute", top: "0.25rem", right: "0.25rem", display: "flex", gap: "0.125rem", opacity: 0 }} className="group-hover:!opacity-100">{item.type === "file" && <button type="button" onClick={(event) => { event.stopPropagation(); handleDownload(item); }} style={{ padding: "0.2rem", borderRadius: "0.25rem", background: "var(--card-elevated)", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><Download className="w-3 h-3" /></button>}<button type="button" onClick={(event) => { event.stopPropagation(); setDeleteTarget(item); }} style={{ padding: "0.2rem", borderRadius: "0.25rem", background: "var(--card-elevated)", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><Trash2 className="w-3 h-3" /></button></div></div>; })}</div>}
      </div>
      <ConfirmDialog open={Boolean(deleteTarget)} title={`Delete ${deleteTarget?.type === "folder" ? "folder" : "file"}?`} description={deleteTarget ? `Delete ${getFilePath(deleteTarget.name)}${deleteTarget.type === "folder" ? " and everything inside it" : ""}? This action cannot be undone.` : ""} confirmLabel="Delete" confirmTone="danger" onCancel={() => setDeleteTarget(null)} onConfirm={() => void handleDelete()} />
      {previewFile && <FilePreview key={previewFile.path} workspace={previewFile.workspace} path={previewFile.path} name={previewFile.name} onClose={() => setPreviewFile(null)} />}
      {editorFile && <EditorModal key={editorFile.path} workspace={editorFile.workspace} filePath={editorFile.path} fileName={editorFile.name} onClose={() => { setEditorDirty(false); setEditorFile(null); void loadItems(); }} onSaved={loadItems} onDirtyStateChange={setEditorDirty} />}
    </>
  );
}
