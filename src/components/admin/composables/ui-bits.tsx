import type { ReactNode } from "react";

/* ---------- Card ---------- */

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-border bg-card ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHead({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border px-3.5 py-2.5">
      <div>
        <div className="text-[11px] font-bold text-gold">{title}</div>
        {subtitle && <div className="text-[9px] text-text-3">{subtitle}</div>}
      </div>
      {action && <div className="text-[9px] font-semibold text-gold">{action}</div>}
    </div>
  );
}

export function CardBody({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`px-3.5 py-3 ${className}`}>{children}</div>;
}

/* ---------- KPI ---------- */

export type KpiTone = "up" | "warn" | "down" | "info";

export function Kpi({
  label,
  value,
  trend,
  tone = "up",
  sub,
  accent,
}: {
  label: string;
  value: string;
  trend?: string;
  tone?: KpiTone;
  sub?: string;
  accent?: string;
}) {
  const trendColor =
    tone === "up"
      ? "text-success"
      : tone === "warn"
        ? "text-gold"
        : tone === "down"
          ? "text-danger"
          : "text-info";
  const defaultAccent =
    tone === "up"
      ? "var(--color-success)"
      : tone === "down"
        ? "var(--color-danger)"
        : tone === "info"
          ? "var(--color-info)"
          : "var(--color-gold)";
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card p-3.5">
      <div
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{ background: accent ?? defaultAccent }}
      />
      <div className="label-eyebrow mb-1.5">{label}</div>
      <div className="text-display mb-0.5 text-[22px] font-black leading-none text-foreground">
        {value}
      </div>
      {trend && <div className={`text-[9px] font-semibold ${trendColor}`}>{trend}</div>}
      {sub && <div className="mt-0.5 text-[9px] text-text-4">{sub}</div>}
    </div>
  );
}

/* ---------- Badge ---------- */

export function Pill({
  tone = "neutral",
  children,
}: {
  tone?: "success" | "gold" | "danger" | "info" | "violet" | "neutral";
  children: ReactNode;
}) {
  const map: Record<string, string> = {
    success: "bg-success-soft text-success",
    gold: "bg-warn-soft text-gold",
    danger: "bg-danger-soft text-danger",
    info: "bg-info-soft text-info",
    violet: "bg-violet-soft text-violet",
    neutral: "bg-bg-4 text-text-2",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-[2px] text-[9px] font-bold ${map[tone]}`}
    >
      {children}
    </span>
  );
}

/* ---------- Filter bar ---------- */

export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3.5 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2.5">
      {children}
    </div>
  );
}

export function FilterLabel({ children }: { children: ReactNode }) {
  return <span className="label-eyebrow">{children}</span>;
}

export function FilterDivider() {
  return <span className="h-4 w-px bg-border" />;
}

export function FilterScope({ children }: { children: ReactNode }) {
  return (
    <span className="ml-auto rounded-full border border-gold-3/30 bg-bg-4 px-2.5 py-[3px] text-[9px] font-bold text-gold">
      {children}
    </span>
  );
}

/* ---------- Progress row ---------- */

export function ProgressRow({
  label,
  value,
  max,
  color = "var(--color-gold)",
  suffix = "",
  display = "count",
}: {
  label: string;
  value: number;
  max: number;
  color?: string;
  suffix?: string;
  display?: "count" | "percent";
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const primary = display === "percent" ? `${pct}%` : `${value.toLocaleString()}${suffix}`;
  const secondary = display === "percent" ? `${value.toLocaleString()}${suffix}` : `${pct}%`;
  return (
    <div className="mb-2 grid grid-cols-[8rem_1fr_5.75rem] items-center gap-2">
      <span className="w-32 shrink-0 truncate text-[10px] text-text-2">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-4">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="shrink-0 text-right text-[10px] font-bold text-text-1">
        {primary} <span className="font-semibold text-text-4">· {secondary}</span>
      </span>
    </div>
  );
}

/* ---------- Section header (page title in content area) ---------- */

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <h1 className="text-display text-2xl font-extrabold text-danger">{title}</h1>
        {description && <p className="mt-1 text-[12px] text-text-3">{description}</p>}
      </div>
      {action}
    </div>
  );
}
