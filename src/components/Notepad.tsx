"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { StickyNote, Trash2 } from "lucide-react";

const STORAGE_KEY = "tenacitas-notepad";

interface StoredNote {
  text?: string;
  ts?: string;
}

function readStoredNote(): { text: string; lastSaved: Date | null } {
  if (typeof window === "undefined") {
    return { text: "", lastSaved: null };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { text: "", lastSaved: null };

    const parsed = JSON.parse(raw) as StoredNote;
    return {
      text: parsed.text || "",
      lastSaved: parsed.ts ? new Date(parsed.ts) : null,
    };
  } catch {
    return { text: "", lastSaved: null };
  }
}

export function Notepad() {
  const initial = readStoredNote();

  const [text, setText] = useState(initial.text);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(initial.lastSaved);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(() => {
    const now = new Date();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ text, ts: now.toISOString() })
    );
    setLastSaved(now);
    setIsDirty(false);
  }, [text]);

  useEffect(() => {
    if (!isDirty) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      save();
    }, 2000);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [isDirty, save]);

  const clear = () => {
    setText("");
    localStorage.removeItem(STORAGE_KEY);
    setIsDirty(false);
    setLastSaved(null);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--card)",
        borderRadius: "0.75rem",
        border: "1px solid var(--border)",
        overflow: "hidden",
        height: "100%",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0.625rem 0.875rem",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        <StickyNote className="w-3.5 h-3.5" style={{ color: "#fbbf24", flexShrink: 0 }} />
        <span
          style={{
            fontSize: "0.75rem",
            color: "var(--text-secondary)",
            flex: 1,
            fontWeight: 500,
          }}
        >
          Notepad
        </span>
        <span
          suppressHydrationWarning
          style={{ fontSize: "0.65rem", color: "var(--text-muted)", minWidth: "72px", textAlign: "right" }}
        >
          {isDirty
            ? "saving..."
            : lastSaved
            ? `saved ${lastSaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
            : ""}
        </span>
        <button
          onClick={clear}
          title="Clear"
          style={{
            padding: "0.2rem",
            borderRadius: "0.25rem",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--text-muted)",
          }}
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {/* Textarea */}
      <textarea
        suppressHydrationWarning
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setIsDirty(true);
        }}
        placeholder="Quick notes, reminders, ideas..."
        style={{
          flex: 1,
          resize: "none",
          border: "none",
          outline: "none",
          padding: "0.75rem",
          backgroundColor: "transparent",
          color: "var(--text-primary)",
          fontSize: "0.8rem",
          lineHeight: 1.6,
          fontFamily: "var(--font-body, sans-serif)",
          minHeight: "120px",
        }}
      />
    </div>
  );
}
