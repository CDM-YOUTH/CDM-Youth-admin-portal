import type { ReactNode } from "react";

/* ---------- Generic chrome ---------- */

export function FilterRow({ children }: { children: ReactNode }) {
  return (
    <div className="border-b border-border bg-bg-2 px-3.5 py-2.5">
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function FilterSearch({
  value,
  onChange,
  placeholder = "Search…",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="min-w-[220px] flex-1 rounded-md border border-border bg-bg-3 px-3 py-1.5 text-[12px] text-foreground outline-none focus:border-gold-3"
    />
  );
}

type Option = { value: string; label: string };

export function FilterSelect({
  label,
  value,
  onChange,
  options,
  accent = "border",
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  accent?: "border" | "gold" | "violet" | "info" | "pink";
  disabled?: boolean;
}) {
  const accentClass =
    accent === "gold"
      ? "border-gold-3 text-gold"
      : accent === "violet"
        ? "border-violet text-violet"
        : accent === "info"
          ? "border-info text-info"
          : accent === "pink"
            ? "border-pink text-pink"
            : "border-border text-text-2";
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      aria-label={label}
      className={`min-w-[128px] rounded-md bg-bg-3 px-2.5 py-1.5 text-[11px] font-semibold outline-none disabled:opacity-40 ${accentClass}`}
    >
      <option value="">{label}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function FilterClear({ onClick, visible }: { onClick: () => void; visible: boolean }) {
  if (!visible) return null;
  return (
    <button
      onClick={onClick}
      className="rounded-md border border-border bg-transparent px-2.5 py-1 text-[10px] font-semibold text-text-3 hover:border-danger hover:text-danger"
    >
      ✕ Clear filters
    </button>
  );
}

export function ActiveFilterCount({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="rounded-full bg-warn-soft px-2 py-[2px] text-[9px] font-bold text-gold">
      {count} filter{count === 1 ? "" : "s"}
    </span>
  );
}