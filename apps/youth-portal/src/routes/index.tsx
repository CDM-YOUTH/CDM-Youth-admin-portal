import { createFileRoute, Link } from "@tanstack/react-router";
import { UserPlus, CalendarDays, GraduationCap, ChevronRight } from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";
import cdmLogo from "@/assets/cdm-logo.jpeg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [{ title: "CDM Youth Portal" }],
  }),
  component: LandingPage,
});

function LandingPage() {
  const { t } = useLanguage();

  const quickLinks = [
    { to: "/register", icon: UserPlus, tone: "bg-danger-soft text-danger", titleKey: "landing.enroll.title", subtitleKey: "landing.enroll.subtitle" },
    { to: "/events", icon: CalendarDays, tone: "bg-warn-soft text-warn", titleKey: "landing.events.title", subtitleKey: "landing.events.subtitle" },
    { to: "/formation", icon: GraduationCap, tone: "bg-success-soft text-success", titleKey: "landing.formation.title", subtitleKey: "landing.formation.subtitle" },
  ] as const;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col bg-background px-5 pb-10 pt-8">
      <div className="flex flex-col items-center text-center">
        <div className="rounded-full bg-danger-soft p-3 ring-4 ring-gold/20">
          <img src={cdmLogo} alt="CDM Youth" className="h-24 w-24 object-contain" />
        </div>
        <h1 className="text-display mt-5 text-2xl font-black text-danger">{t("landing.title")}</h1>
        <p className="mt-2 text-[13px] text-text-3">{t("landing.subtitle")}</p>
      </div>

      <div className="mt-8 space-y-3">
        <Link
          to="/login"
          className="block w-full rounded-xl bg-danger py-3.5 text-center text-[14px] font-bold text-white shadow-md"
        >
          {t("landing.signIn")}
        </Link>
        <Link
          to="/register"
          className="block w-full rounded-xl border-2 border-success py-3.5 text-center text-[14px] font-bold text-success"
        >
          {t("landing.register")}
        </Link>
      </div>

      <div className="mt-8 space-y-3">
        {quickLinks.map(({ to, icon: Icon, tone, titleKey, subtitleKey }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm"
          >
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}>
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-bold text-foreground">{t(titleKey)}</span>
              <span className="block truncate text-[11px] text-text-3">{t(subtitleKey)}</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-text-4" />
          </Link>
        ))}
      </div>
    </main>
  );
}
