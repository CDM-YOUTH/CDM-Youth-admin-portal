import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  UserPlus,
  Users,
  Calendar,
  Compass,
  GraduationCap,
  BookOpen,
  HeartPulse,
  Shirt,
  BarChart3,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useSidebar } from "./sidebar-context";

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: { text: string; tone: "danger" | "gold" | "info" };
};

type NavGroup = { label: string; items: NavItem[] };

const GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [{ to: "/admin", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Youth",
    items: [
      {
        to: "/admin/enrollment",
        label: "Enrollment",
        icon: UserPlus,
        badge: { text: "23", tone: "danger" },
      },
      { to: "/admin/youths", label: "Youth Records", icon: Users },
    ],
  },
  {
    label: "Activities",
    items: [
      { to: "/admin/events", label: "Events", icon: Calendar },
      {
        to: "/admin/mission",
        label: "Mission Week",
        icon: Compass,
        badge: { text: "Active", tone: "gold" },
      },
      {
        to: "/admin/cusa",
        label: "CUSA",
        icon: GraduationCap,
        badge: { text: "312", tone: "info" },
      },
    ],
  },
  {
    label: "Pastoral",
    items: [
      { to: "/admin/formation", label: "Formation", icon: BookOpen },
      {
        to: "/admin/welfare",
        label: "Welfare",
        icon: HeartPulse,
        badge: { text: "5", tone: "danger" },
      },
      { to: "/admin/uniforms", label: "Uniforms", icon: Shirt },
    ],
  },
  {
    label: "Admin",
    items: [
      { to: "/admin/reports", label: "Reports", icon: BarChart3 },
      { to: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
];

function Badge({
  text,
  tone,
  collapsed,
}: {
  text: string;
  tone: "danger" | "gold" | "info";
  collapsed: boolean;
}) {
  const styles =
    tone === "danger"
      ? "bg-danger text-white"
      : tone === "gold"
        ? "bg-gold-3 text-gold-foreground"
        : "bg-success-soft text-success border border-success/30";
  if (collapsed) {
    // Tiny dot indicator in icon-only mode
    const dot =
      tone === "danger" ? "bg-danger" : tone === "gold" ? "bg-gold" : "bg-success";
    return (
      <span
        className={`absolute right-1 top-1 h-1.5 w-1.5 rounded-full ${dot}`}
        aria-label={text}
      />
    );
  }
  return (
    <span
      className={`ml-auto rounded-full px-2 py-[2px] text-[9px] font-bold leading-none ${styles}`}
    >
      {text}
    </span>
  );
}

export function AdminSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { collapsed, toggle } = useSidebar();
  const width = collapsed ? "w-[60px]" : "w-[220px]";

  return (
    <aside
      className={`flex h-screen ${width} shrink-0 flex-col border-r border-border bg-card transition-[width] duration-200`}
    >
      {/* Brand / toggle */}
      <div
        className={`flex items-center gap-2.5 border-b border-border py-4 ${
          collapsed ? "justify-center px-2" : "px-3.5"
        }`}
      >
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-gold text-[11px] font-black text-gold-foreground transition-opacity hover:opacity-90"
        >
          CDM
        </button>
        {!collapsed && (
          <>
            <div className="leading-tight">
              <div className="text-[11px] font-bold text-foreground">Youth Office</div>
              <div className="text-[9px] text-text-3">Diocese of Murang'a</div>
            </div>
            <button
              type="button"
              onClick={toggle}
              aria-label="Collapse sidebar"
              className="ml-auto flex h-6 w-6 items-center justify-center rounded-md text-text-3 hover:bg-bg-3 hover:text-text-1"
            >
              <PanelLeftClose className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-2">
        {collapsed && (
          <button
            type="button"
            onClick={toggle}
            aria-label="Expand sidebar"
            className="mb-2 flex w-full items-center justify-center rounded-md py-1.5 text-text-3 hover:bg-bg-3 hover:text-text-1"
          >
            <PanelLeftOpen className="h-3.5 w-3.5" />
          </button>
        )}
        {GROUPS.map((group) => (
          <div key={group.label} className="mb-1">
            {!collapsed && (
              <div className="label-eyebrow px-2 pb-1 pt-2.5">{group.label}</div>
            )}
            {collapsed && <div className="my-2 h-px bg-border/60" />}
            {group.items.map((item) => {
              const isActive =
                item.to === "/admin"
                  ? pathname === "/admin"
                  : pathname === item.to || pathname.startsWith(item.to + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  title={collapsed ? item.label : undefined}
                  className={`relative mb-[2px] flex items-center rounded-lg text-[12px] font-medium transition-colors ${
                    collapsed
                      ? "h-9 justify-center"
                      : "gap-2.5 px-2.5 py-[7px]"
                  } ${
                    isActive
                      ? "bg-accent font-bold text-danger"
                      : "text-text-2 hover:bg-bg-3 hover:text-text-1"
                  }`}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-3.5 w-[3px] -translate-y-1/2 rounded-r bg-danger" />
                  )}
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                  {item.badge && <Badge {...item.badge} collapsed={collapsed} />}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer / user */}
      <div
        className={`flex items-center gap-2.5 border-t border-border py-2.5 ${
          collapsed ? "justify-center px-2" : "px-3"
        }`}
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-gold-3 bg-bg-4 text-[9px] font-bold text-gold">
          JM
        </div>
        {!collapsed && (
          <>
            <div className="leading-tight">
              <div className="text-[10px] font-semibold text-text-1">John Mwangi</div>
              <div className="text-[9px] text-text-3">Diocese Admin</div>
            </div>
            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-success" />
          </>
        )}
      </div>
    </aside>
  );
}
