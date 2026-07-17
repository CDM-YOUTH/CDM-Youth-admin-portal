import { Link, useRouterState } from "@tanstack/react-router";
import { Home, CalendarDays, GraduationCap, UserRound } from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const { t } = useLanguage();
  const { status } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const tabs = [
    { to: status === "authed" ? "/home" : "/", labelKey: "nav.home", icon: Home } as const,
    { to: "/events", labelKey: "nav.events", icon: CalendarDays } as const,
    { to: "/formation", labelKey: "nav.formation", icon: GraduationCap } as const,
    { to: status === "authed" ? "/account" : "/login", labelKey: "nav.account", icon: UserRound } as const,
  ];

  return (
    <nav className="safe-bottom sticky bottom-0 z-40 border-t border-border bg-white">
      <div className="mx-auto grid max-w-md grid-cols-4">
        {tabs.map(({ to, labelKey, icon: Icon }) => {
          const active = pathname === to || pathname.startsWith(`${to}/`);
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[10px] font-bold",
                active ? "text-danger" : "text-text-3",
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
              {t(labelKey)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
