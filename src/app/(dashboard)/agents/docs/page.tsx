"use client";

import { useState } from "react";
import { FileText, ChevronRight } from "lucide-react";
import { fileTypeConfig } from "@/data/mockDocsData";
import type { DocFolder, DocFile } from "@/data/mockDocsData";
import { useFetch } from "@/lib/useFetch";

export default function DocsPage() {
  const [activeFolder, setActiveFolder] = useState("general");
  const { data, loading, error, refetch } = useFetch<{ folders: DocFolder[]; files: DocFile[] }>("/api/docs");
  const folders = data?.folders || [];
  const files = data?.files || [];
  const activeFiles = files.filter((f) => f.folderId === activeFolder);
  const activeFolderData = folders.find((f) => f.id === activeFolder);

  if (loading) {
    return (
      <div className="p-4 md:p-8">
        <div className="flex items-center justify-center h-64">
          <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>Loading docs...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-8">
        <div className="flex items-center justify-center h-64">
          <p style={{ color: "var(--status-error)", fontSize: "14px" }}>Failed to load docs: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1
          className="text-3xl font-bold mb-2"
          style={{ fontFamily: "var(--font-heading)", color: "var(--text-primary)", letterSpacing: "-1.5px" }}
        >
          <FileText className="inline-block w-8 h-8 mr-2 mb-1" />
          Docs
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
          {files.length} files &bull; {folders.length} folders
        </p>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-4 md:gap-6">
        {/* Folder sidebar */}
        <div
          className="w-[220px] flex-shrink-0 rounded-xl p-3"
          style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
        >
          <span
            className="text-[10px] font-bold uppercase tracking-wider block mb-3 px-2"
            style={{ color: "var(--text-muted)" }}
          >
            Folders
          </span>
          <div className="space-y-0.5">
            {folders.map((folder) => {
              const isActive = activeFolder === folder.id;
              return (
                <button
                  key={folder.id}
                  onClick={() => setActiveFolder(folder.id)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors duration-150"
                  style={{
                    backgroundColor: isActive ? "var(--surface-elevated)" : "transparent",
                    borderLeft: isActive ? "2px solid #0A84FF" : "2px solid transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = "var(--surface-hover)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <span className="text-sm">{folder.emoji}</span>
                  <span
                    className="text-xs font-medium truncate flex-1"
                    style={{ color: isActive ? "var(--text-primary)" : "var(--text-secondary)" }}
                  >
                    {folder.name}
                  </span>
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                    {folder.fileCount}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* File list panel */}
        <div className="flex-1 min-w-0 rounded-xl overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>Docs</span>
            <ChevronRight className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
            <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
              {activeFolderData?.emoji} {activeFolderData?.name}
            </span>
          </div>

          {/* Table header */}
          <div
            className="flex items-center gap-3 px-5 py-2"
            style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--surface-elevated)" }}
          >
            <span className="flex-[3] text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Name</span>
            <span className="flex-[1] text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Type</span>
            <span className="flex-[0.8] text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Size</span>
            <span className="flex-[1] text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Modified</span>
            <span className="flex-[1.2] text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Author</span>
          </div>

          {/* File rows */}
          {activeFiles.map((file) => (
            <FileRow key={file.id} file={file} />
          ))}

          {activeFiles.length === 0 && (
            <div className="p-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
              No files in this folder.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FileRow({ file }: { file: DocFile }) {
  const typeInfo = fileTypeConfig[file.type];
  return (
    <div
      className="flex items-center gap-3 px-5 py-2.5 transition-colors duration-150 cursor-pointer"
      style={{ borderBottom: "1px solid var(--border)" }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--surface-hover)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
    >
      <div className="flex-[3] flex items-center gap-2 min-w-0">
        <span className="text-sm flex-shrink-0">{typeInfo.icon}</span>
        <span className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{file.name}</span>
      </div>
      <div className="flex-[1]">
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{
            backgroundColor: `color-mix(in srgb, ${typeInfo.color} 15%, transparent)`,
            color: typeInfo.color,
            border: `1px solid color-mix(in srgb, ${typeInfo.color} 30%, transparent)`,
          }}
        >
          {typeInfo.label}
        </span>
      </div>
      <div className="flex-[0.8]">
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>{file.size}</span>
      </div>
      <div className="flex-[1]">
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {new Date(file.modifiedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </span>
      </div>
      <div className="flex-[1.2] flex items-center gap-1.5">
        <span
          className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] flex-shrink-0"
          style={{
            backgroundColor: `${file.modifiedBy.color}20`,
            border: `1.5px solid ${file.modifiedBy.color}40`,
          }}
        >
          {file.modifiedBy.emoji}
        </span>
        <span className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{file.modifiedBy.name}</span>
      </div>
    </div>
  );
}