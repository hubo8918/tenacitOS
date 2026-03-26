"use client";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  confirmTone?: "danger" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  confirmTone = "primary",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999,
        backgroundColor: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
    >
      <div
        style={{
          backgroundColor: "var(--card)",
          borderRadius: "1rem",
          padding: "1.5rem",
          maxWidth: "420px",
          width: "100%",
          border: "1px solid var(--border)",
        }}
      >
        <h3
          style={{
            color: "var(--text-primary)",
            marginBottom: "0.75rem",
            fontSize: "1.1rem",
            fontWeight: 600,
          }}
        >
          {title}
        </h3>
        <p
          style={{
            color: "var(--text-secondary)",
            marginBottom: "1.5rem",
            fontSize: "0.9rem",
            lineHeight: 1.6,
          }}
        >
          {description}
        </p>
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              background: "var(--card-elevated)",
              color: "var(--text-secondary)",
              border: "none",
              cursor: "pointer",
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              background: confirmTone === "danger" ? "var(--error, #ef4444)" : "var(--accent)",
              color: confirmTone === "danger" ? "#fff" : "#000",
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
