import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { UserPlus, CalendarDays, GraduationCap, ChevronRight, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import cdmLogo from "@/assets/cdm-logo.jpeg";

export const Route = createFileRoute("/portal/")({
  component: PortalHome,
});

function PortalHome() {
  const navigate = useNavigate();
  const [user, setUser] = useState<{ email?: string | null } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <div className="px-5 pt-6">
      {/* Hero */}
      <section className="rounded-3xl bg-gradient-to-b from-danger-soft via-white to-white px-6 py-8 text-center shadow-sm ring-1 ring-gold/20">
        <div className="relative mx-auto mb-4 inline-block">
          <div className="absolute inset-0 scale-150 rounded-full bg-gold/15 blur-2xl" />
          <img
            src={cdmLogo}
            alt="Catholic Diocese of Murang'a Youth"
            className="relative h-36 w-36 rounded-full object-contain"
          />
        </div>
        <h1 className="text-display text-2xl font-black leading-tight text-danger">
          Catholic Diocese<br />of Murang'a
        </h1>
        <p className="mt-2 text-[13px] text-text-2">Your home in the Diocese of Murang'a.</p>
      </section>

      {/* Auth buttons */}
      {!user ? (
        <div className="mt-5 space-y-3">
          <Link
            to="/portal/auth"
            search={{ mode: "signin" }}
            className="block w-full rounded-2xl bg-danger py-4 text-center text-[15px] font-bold text-white shadow-md transition-opacity hover:opacity-90"
          >
            Sign In
          </Link>
          <Link
            to="/portal/auth"
            search={{ mode: "signup" }}
            className="block w-full rounded-2xl border-2 border-success bg-white py-4 text-center text-[15px] font-bold text-success transition-colors hover:bg-success-soft"
          >
            Register
          </Link>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-success/30 bg-success-soft px-4 py-3 text-[12px] font-semibold text-success">
          Signed in as {user.email ?? "you"}.{" "}
          <Link to="/portal/account" className="underline">
            View account
          </Link>
        </div>
      )}

      {/* Quick actions */}
      <section className="mt-6 space-y-3">
        <QuickAction
          to="/portal/enroll"
          icon={<UserPlus className="h-5 w-5 text-danger" />}
          tone="bg-danger-soft"
          title="Enroll"
          subtitle="Join our faith community today."
        />
        <QuickAction
          to="/portal/events"
          icon={<CalendarDays className="h-5 w-5 text-gold-3" />}
          tone="bg-warn-soft"
          title="Events"
          subtitle="Stay updated with diocesan activities."
        />
        <QuickAction
          to="/portal/formation"
          icon={<GraduationCap className="h-5 w-5 text-success" />}
          tone="bg-success-soft"
          title="Formation"
          subtitle="Grow in your spiritual journey."
        />
      </section>

      {/* Footer mark */}
      <section className="mt-8 mb-4 rounded-2xl bg-bg-2 p-4 text-center">
        <div className="text-[11px] font-bold uppercase tracking-wider text-gold-3">Faith in Action</div>
        <div className="mt-1 text-[12px] text-text-2">Empowering the youth of Murang'a since 1983.</div>
      </section>

      {user && (
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            await navigate({ to: "/portal" });
          }}
          className="mx-auto mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-text-3 hover:text-danger"
        >
          <LogOut className="h-3.5 w-3.5" /> Sign out
        </button>
      )}
    </div>
  );
}

function QuickAction({
  to,
  icon,
  tone,
  title,
  subtitle,
}: {
  to: string;
  icon: React.ReactNode;
  tone: string;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-2xl border border-border bg-white p-4 shadow-sm transition-colors hover:border-gold/40"
    >
      <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}>{icon}</div>
      <div className="flex-1">
        <div className="text-[13px] font-bold text-foreground">{title}</div>
        <div className="text-[11px] text-text-3">{subtitle}</div>
      </div>
      <ChevronRight className="h-4 w-4 text-text-3" />
    </Link>
  );
}