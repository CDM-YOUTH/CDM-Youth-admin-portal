import { useEffect, useRef, useState, type ReactNode } from "react";
import { Download, Filter, Plus, Search, Upload, X } from "lucide-react";

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

/* ---------- Toolbar (Search left · actions right) ---------- */

export function TableToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search…",
  onImport,
  onExport,
  onAdd,
  addLabel = "Add",
  extra,
}: {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  onImport?: () => void;
  onExport?: () => void;
  onAdd?: () => void;
  addLabel?: string;
  extra?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-3.5 py-2.5">
      <div className="relative max-w-sm flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-4" />
        <input
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          className="h-8 w-full rounded-md border border-border bg-bg-2 pl-8 pr-7 text-[12px] text-foreground outline-none focus:border-gold-3"
        />
        {searchValue && (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-text-3 hover:bg-bg-3 hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      {extra}
      <div className="ml-auto flex items-center gap-1.5">
        {onImport && (
          <button
            type="button"
            onClick={onImport}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-bg-2 px-2.5 text-[11px] font-semibold text-text-1 transition hover:border-gold-3 hover:text-gold"
          >
            <Upload className="h-3.5 w-3.5" /> Import
          </button>
        )}
        {onExport && (
          <button
            type="button"
            onClick={onExport}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-bg-2 px-2.5 text-[11px] font-semibold text-text-1 transition hover:border-gold-3 hover:text-gold"
          >
            <Download className="h-3.5 w-3.5" /> Export
          </button>
        )}
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[11px] font-bold text-primary-foreground transition hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" /> {addLabel}
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------- Per-column filter (popover with operator + value) ---------- */

export type ColumnFilterOperator = "equals" | "contains" | "startsWith" | "notEquals";

export type ColumnFilterValue = {
  operator: ColumnFilterOperator;
  value: string;
};

const TEXT_OPERATORS: { value: ColumnFilterOperator; label: string }[] = [
  { value: "contains", label: "Contains" },
  { value: "equals", label: "Equals" },
  { value: "startsWith", label: "Starts with" },
  { value: "notEquals", label: "Not equals" },
];

const SELECT_OPERATORS: { value: ColumnFilterOperator; label: string }[] = [
  { value: "equals", label: "Equals" },
  { value: "notEquals", label: "Not equals" },
];

export function applyColumnFilter(cell: string | null | undefined, filter?: ColumnFilterValue) {
  if (!filter || !filter.value) return true;
  const haystack = (cell ?? "").toString().toLowerCase();
  const needle = filter.value.toLowerCase();
  switch (filter.operator) {
    case "equals":
      return haystack === needle;
    case "notEquals":
      return haystack !== needle;
    case "startsWith":
      return haystack.startsWith(needle);
    case "contains":
    default:
      return haystack.includes(needle);
  }
}

export function ColumnFilter({
  label,
  value,
  onChange,
  options,
  mode = "text",
}: {
  label: string;
  value?: ColumnFilterValue;
  onChange: (value: ColumnFilterValue | undefined) => void;
  options?: { value: string; label: string }[];
  mode?: "text" | "select";
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ColumnFilterValue>(
    value ?? { operator: mode === "select" ? "equals" : "contains", value: "" },
  );
  const ref = useRef<HTMLDivElement>(null);
  const active = Boolean(value?.value);

  useEffect(() => {
    setDraft(value ?? { operator: mode === "select" ? "equals" : "contains", value: "" });
  }, [value, mode]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const apply = () => {
    if (!draft.value) {
      onChange(undefined);
    } else {
      onChange(draft);
    }
    setOpen(false);
  };

  const clear = () => {
    setDraft({ operator: mode === "select" ? "equals" : "contains", value: "" });
    onChange(undefined);
    setOpen(false);
  };

  const operators = mode === "select" ? SELECT_OPERATORS : TEXT_OPERATORS;

  return (
    <span ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={`Filter ${label}`}
        className={`ml-1 inline-flex h-5 w-5 items-center justify-center rounded transition ${
          active
            ? "bg-primary text-primary-foreground"
            : "text-text-4 hover:bg-bg-3 hover:text-text-1"
        }`}
      >
        <Filter className="h-3 w-3" />
      </button>
      {open && (
        <div className="absolute left-0 top-7 z-30 w-56 rounded-lg border border-border bg-card p-2 shadow-2xl">
          <div className="mb-1.5 text-[9px] font-bold uppercase tracking-wide text-text-4">
            {label}
          </div>
          <select
            value={draft.operator}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, operator: event.target.value as ColumnFilterOperator }))
            }
            className="mb-1.5 w-full rounded-md border border-border bg-bg-2 px-2 py-1 text-[11px] text-foreground outline-none"
          >
            {operators.map((op) => (
              <option key={op.value} value={op.value}>
                {op.label}
              </option>
            ))}
          </select>
          {mode === "select" ? (
            <select
              value={draft.value}
              onChange={(event) => setDraft((prev) => ({ ...prev, value: event.target.value }))}
              className="mb-2 w-full rounded-md border border-border bg-bg-2 px-2 py-1 text-[11px] text-foreground outline-none"
            >
              <option value="">Select…</option>
              {options?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              autoFocus
              value={draft.value}
              onChange={(event) => setDraft((prev) => ({ ...prev, value: event.target.value }))}
              onKeyDown={(event) => {
                if (event.key === "Enter") apply();
                if (event.key === "Escape") setOpen(false);
              }}
              placeholder="Value…"
              className="mb-2 w-full rounded-md border border-border bg-bg-2 px-2 py-1 text-[11px] text-foreground outline-none focus:border-gold-3"
            />
          )}
          <div className="flex items-center justify-between gap-1.5">
            <button
              type="button"
              onClick={clear}
              className="rounded-md border border-border bg-transparent px-2 py-1 text-[10px] font-semibold text-text-3 hover:border-danger hover:text-danger"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={apply}
              className="rounded-md bg-primary px-3 py-1 text-[10px] font-bold text-primary-foreground hover:opacity-90"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </span>
  );
}

export function ColumnHeader({
  label,
  filter,
}: {
  label: string;
  filter?: ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-0.5">
      <span>{label}</span>
      {filter}
    </span>
  );
}