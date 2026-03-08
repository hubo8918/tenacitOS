interface TierDividerProps {
  label: string;
}

export function TierDivider({ label }: TierDividerProps) {
  return (
    <div className="flex items-center gap-4 my-8 md:my-12 px-4">
      {/* Left line */}
      <div
        className="flex-1 h-px"
        style={{ backgroundColor: "var(--border)" }}
      />

      {/* Label */}
      <span
        className="text-xs md:text-sm whitespace-nowrap"
        style={{
          color: "var(--text-muted)",
          fontFamily: "var(--font-heading)",
          fontWeight: 600,
          letterSpacing: "2px",
        }}
      >
        {label}
      </span>

      {/* Right line */}
      <div
        className="flex-1 h-px"
        style={{ backgroundColor: "var(--border)" }}
      />
    </div>
  );
}
