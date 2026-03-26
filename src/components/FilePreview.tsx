"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import {
  X,
  Download,
  FileText,
  Loader2,
  AlertCircle,
  Copy,
  Check,
} from "lucide-react";

import { getDownloadUrl, readFile } from "@/lib/files-client";

interface FilePreviewProps {
  workspace: string;
  path: string;
  name: string;
  onClose: () => void;
}

function getFileExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() || "";
}

function getLanguage(ext: string): string {
  const languageMap: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    json: "json",
    py: "python",
    md: "markdown",
    css: "css",
    html: "html",
    yaml: "yaml",
    yml: "yaml",
    sh: "bash",
    bash: "bash",
    sql: "sql",
  };
  return languageMap[ext] || "plaintext";
}

function isImageFile(ext: string): boolean {
  return ["png", "jpg", "jpeg", "gif", "webp", "svg", "ico"].includes(ext);
}

function isMarkdown(ext: string): boolean {
  return ext === "md" || ext === "mdx";
}

function isCodeFile(ext: string): boolean {
  return [
    "ts",
    "tsx",
    "js",
    "jsx",
    "json",
    "py",
    "css",
    "html",
    "yaml",
    "yml",
    "sh",
    "bash",
    "sql",
    "xml",
    "toml",
  ].includes(ext);
}

export function FilePreview({ workspace, path, name, onClose }: FilePreviewProps) {
  const ext = getFileExtension(name);
  const isImage = isImageFile(ext);
  const isMd = isMarkdown(ext);
  const isCode = isCodeFile(ext);

  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => !isImage);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isImage) {
      return;
    }

    readFile(workspace, path)
      .then((data) => {
        if (!("content" in data)) {
          throw new Error("Failed to load file.");
        }
        setContent(data.content);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load file.");
        setLoading(false);
      });
  }, [workspace, path, isImage]);

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = getDownloadUrl(workspace, path);
    a.download = name;
    a.click();
  };

  const handleCopy = async () => {
    if (content) {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.8)" }}
    >
      <div
        className="rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl"
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--border)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-3">
            <FileText
              className="w-5 h-5"
              style={{ color: "var(--text-secondary)" }}
            />
            <span
              className="font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              {name}
            </span>
            <span
              className="text-xs px-2 py-1 rounded"
              style={{
                backgroundColor: "var(--background)",
                color: "var(--text-muted)",
              }}
            >
              {ext.toUpperCase() || "FILE"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {content && (
              <>
                <button
                  onClick={handleCopy}
                  className="p-2 rounded-lg transition-colors"
                  style={{ color: "var(--text-secondary)" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--border)";
                    e.currentTarget.style.color = "var(--text-primary)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = "var(--text-secondary)";
                  }}
                  title="Copy content"
                >
                  {copied ? (
                    <Check
                      className="w-5 h-5"
                      style={{ color: "var(--accent)" }}
                    />
                  ) : (
                    <Copy className="w-5 h-5" />
                  )}
                </button>
                <button
                  onClick={handleDownload}
                  className="p-2 rounded-lg transition-colors"
                  style={{ color: "var(--text-secondary)" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--border)";
                    e.currentTarget.style.color = "var(--text-primary)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = "var(--text-secondary)";
                  }}
                  title="Download file"
                >
                  <Download className="w-5 h-5" />
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg transition-colors"
              style={{ color: "var(--text-secondary)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--border)";
                e.currentTarget.style.color = "var(--text-primary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.color = "var(--text-secondary)";
              }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <Loader2
                className="w-8 h-8 animate-spin"
                style={{ color: "var(--accent)" }}
              />
            </div>
          )}

          {error && (
            <div
              className="flex flex-col items-center justify-center h-full"
              style={{ color: "var(--accent)" }}
            >
              <AlertCircle className="w-12 h-12 mb-4" />
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && isImage && (
            <div className="flex items-center justify-center h-full">
              <div className="relative w-full h-full">
                <Image
                  src={`/api/browse?workspace=${encodeURIComponent(workspace)}&path=${encodeURIComponent(path)}&raw=true`}
                  alt={name}
                  fill
                  unoptimized
                  sizes="100vw"
                  className="object-contain rounded-lg"
                  onError={() => setError("Failed to load image")}
                />
              </div>
            </div>
          )}

          {!loading && !error && isMd && content && (
            <div className="prose prose-invert max-w-none" style={{ color: "var(--text-secondary)" }}>
              <ReactMarkdown
                components={{
                  a: ({ ...props }) => (
                    <a
                      {...props}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "#60A5FA" }}
                    />
                  ),
                  code: ({ className, children, ...props }) => (
                    <code
                      {...props}
                      className={className}
                      style={{
                        backgroundColor: "var(--background)",
                        padding: "0.125rem 0.375rem",
                        borderRadius: "0.25rem",
                        color: "var(--accent)",
                      }}
                    >
                      {children}
                    </code>
                  ),
                  pre: ({ children, ...props }) => (
                    <pre
                      {...props}
                      style={{
                        backgroundColor: "var(--background)",
                        padding: "1rem",
                        borderRadius: "0.5rem",
                        margin: "1rem 0",
                        overflowX: "auto",
                      }}
                    >
                      {children}
                    </pre>
                  ),
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          )}

          {!loading && !error && isCode && content && (
            <pre
              className="p-4 rounded-lg overflow-x-auto"
              style={{ backgroundColor: "var(--background)" }}
            >
              <code
                className={`language-${getLanguage(ext)} text-sm`}
                style={{ color: "var(--text-secondary)" }}
              >
                {content}
              </code>
            </pre>
          )}

          {!loading && !error && !isImage && !isMd && !isCode && content && (
            <pre
              className="p-4 rounded-lg overflow-x-auto text-sm whitespace-pre-wrap"
              style={{
                backgroundColor: "var(--background)",
                color: "var(--text-secondary)",
              }}
            >
              {content}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
