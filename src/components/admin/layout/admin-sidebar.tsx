import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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
  Shield,
  ClipboardList,
  PanelLeftClose,
  PanelLeftOpen,
  Crown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useSidebar } from "./sidebar-context";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile } from "@/lib/db/youth-records/profiles";

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
      { to: "/admin/youths", label: "Youth Records", icon: Users },
      {
        to: "/admin/enrollment",
        label: "Enrollment",
        icon: UserPlus,
        // badge: { text: "", tone: "danger" },
      },
      { to: "/admin/leaders", label: "Leaders", icon: Crown },
      {
        to: "/admin/cusa",
        label: "CUSA",
        icon: GraduationCap,
        // badge: { text: "312", tone: "info" },
      },
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
    ],
  },
  // {
  //   label: "Pastoral",
  //   items: [
  //     { to: "/admin/formation", label: "Formation", icon: BookOpen },
  //     {
  //       to: "/admin/welfare",
  //       label: "Welfare",
  //       icon: HeartPulse,
  //       badge: { text: "5", tone: "danger" },
  //     },
  //     { to: "/admin/uniforms", label: "Uniforms", icon: Shirt },
  //   ],
  // },
  // {
  //   label: "Admin",
  //   items: [
  //     { to: "/admin/reports", label: "Reports", icon: BarChart3 },
  //     { to: "/admin/users", label: "User Mgmt", icon: Shield },
  //     { to: "/admin/audit", label: "Audit Log", icon: ClipboardList },
  //     { to: "/admin/settings", label: "Settings", icon: Settings },
  //   ],
  // },
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

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0]! + parts[parts.length - 1][0]!).toUpperCase();
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return "?";
}

export function AdminSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { collapsed, toggle } = useSidebar();

  const { data: me } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const profile = await getMyProfile().catch(() => null);
      const name = profile?.full_name || user.email || "";
      return { email: user.email ?? "", name, position: profile?.position ?? null };
    },
    staleTime: 5 * 60_000,
  });

  const initials = me?.name ? getInitials(me.name) : "?";
  const displayName = me?.name || "—";
  const subtitle = me?.position || me?.email || "";
  const width = collapsed ? "w-[60px]" : "w-[220px]";

  return (
    <aside
      className={`flex h-full ${width} shrink-0 flex-col border-r border-border bg-card transition-[width] duration-200`}
    >
      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-2">
        <div
          className={`mb-2 flex items-center border-b border-border pb-2 ${
            collapsed ? "justify-center" : "justify-between px-1"
          }`}
        >
          {!collapsed && (
            <span className="text-[9px] font-bold uppercase tracking-widest text-text-4">
              Powered by CDM
            </span>
          )}
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex items-center justify-center rounded-md p-1 text-text-3 hover:bg-bg-3 hover:text-text-1"
          >
            {collapsed ? (
              <PanelLeftOpen className="h-3.5 w-3.5" />
            ) : (
              <PanelLeftClose className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
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
                  className={`relative mb-[2px] flex items-center rounded-lg text-[12px] font-bold transition-colors ${
                    collapsed
                      ? "h-9 justify-center"
                      : "gap-2.5 px-2.5 py-[7px]"
                  } ${
                    isActive
                      ? "bg-accent font-bold text-danger"
                      : "text-gold-3 hover:bg-bg-3 hover:text-gold-3"
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
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-danger text-[9px] font-bold text-white ring-2 ring-danger/20">
          {initials}
        </div>
        {!collapsed && (
          <>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-[10px] font-semibold text-text-1">{displayName}</div>
              {subtitle && (
                <div className="truncate text-[9px] text-text-3">{subtitle}</div>
              )}
            </div>
            <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
          </>
        )}
      </div>
    </aside>
  );
}
