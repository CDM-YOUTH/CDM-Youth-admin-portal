import type { ReactNode } from "react";

export function Topbar({
  title,
  tabs,
  action,
}: {
  title: string;
  tabs?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-12 items-center gap-0 border-b border-border bg-card px-5">
      <div className="mr-3.5 shrink-0 py-3.5 text-[14px] font-extrabold text-foreground">
        {title}
      </div>
      {tabs && <div className="flex flex-1 gap-0">{tabs}</div>}
      <div className="ml-auto flex items-center gap-2">
        <span className="rounded-full border border-bg-4 bg-bg-3 px-2.5 py-[3px] text-[9px] font-bold text-success">
          Year 2026
        </span>
        <span className="flex items-center gap-1 rounded-full border border-border bg-bg-3 px-2.5 py-[3px] text-[9px] text-text-3">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          Live
        </span>
        {action}
      </div>
    </div>
  );
}

export function TopbarTab({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex h-12 items-center whitespace-nowrap border-b-2 px-3.5 text-[11px] font-semibold transition-colors ${
        active
          ? "border-gold text-gold"
          : "border-transparent text-text-3 hover:text-text-1"
      }`}
    >
      {children}
    </button>
  );
}

export function TopbarButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg bg-primary px-3.5 py-1.5 text-[11px] font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
    >
      {children}
    </button>
  );
}
