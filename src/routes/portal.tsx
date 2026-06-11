import { createFileRoute, Outlet, Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Home, Calendar, GraduationCap, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import cdmLogo from "@/assets/cdm-logo.jpeg";

export const Route = createFileRoute("/portal")({
  head: () => ({
    meta: [
      { title: "Youth Portal — Catholic Diocese of Murang'a" },
      {
        name: "description",
        content:
          "Your home in the Diocese of Murang'a — enroll, browse events, track formation and manage your account.",
      },
    ],
  }),
  component: PortalLayout,
});

function PortalLayout() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setSignedIn(!!data.user);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSignedIn(!!session?.user);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const onAuthPage = pathname === "/portal/auth";

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-bg-1 text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-white/95 px-5 py-3 backdrop-blur">
        <Link to="/portal" className="flex items-center gap-2">
          <span className="text-[16px] font-extrabold text-danger">Diocese of Murang'a</span>
        </Link>
        <img src={cdmLogo} alt="CDM" className="h-9 w-9 rounded-full object-cover ring-2 ring-gold/40" />
      </header>

      {/* Page content */}
      <main className={`flex-1 ${onAuthPage ? "" : "pb-24"}`}>
        <Outlet />
      </main>

      {/* Bottom nav — hidden on auth page */}
      {!onAuthPage && (
        <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-md items-stretch justify-around border-t border-border bg-white/95 px-3 py-2 backdrop-blur">
          <NavItem to="/portal" exact icon={<Home className="h-5 w-5" />} label="Home" />
          <NavItem to="/portal/events" icon={<Calendar className="h-5 w-5" />} label="Events" />
          <NavItem to="/portal/formation" icon={<GraduationCap className="h-5 w-5" />} label="Formation" />
          <NavItem
            to={signedIn ? "/portal/account" : "/portal/auth"}
            icon={<User className="h-5 w-5" />}
            label="Account"
          />
        </nav>
      )}
    </div>
  );
}

function NavItem({
  to,
  icon,
  label,
  exact,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  exact?: boolean;
}) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: !!exact }}
      className="group flex flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-text-3 transition-colors data-[status=active]:text-white"
      activeProps={{ className: "bg-danger text-white" }}
    >
      {icon}
      <span className="text-[10px] font-bold uppercase tracking-wide">{label}</span>
    </Link>
  );
}