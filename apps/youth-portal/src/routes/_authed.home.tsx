import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { UserPlus, Shirt, HeartHandshake, Compass, Bell, ChevronRight, MapPin } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n/context";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authed/home")({
  head: () => ({ meta: [{ title: "Home — CDM Youth Portal" }] }),
  component: HomePage,
});

const CURRENT_YEAR = new Date().getFullYear();

function HomePage() {
  const { t } = useLanguage();
  const { youth, session } = useAuth();

  const { data: enrollment } = useQuery({
    queryKey: ["enrollment", youth?.id, CURRENT_YEAR],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("status, amount")
        .eq("youth_id", youth!.id)
        .eq("year", CURRENT_YEAR)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!youth?.id,
  });

  const { data: events } = useQuery({
    queryKey: ["upcoming-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, name, venue, event_date")
        .gte("event_date", new Date().toISOString())
        .order("event_date", { ascending: true })
        .limit(3);
      if (error) throw error;
      return data;
    },
  });

  const { data: notification } = useQuery({
    queryKey: ["latest-notification", session?.user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, body, created_at")
        .eq("user_id", session!.user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!session?.user.id,
  });

  const quickActions = [
    { icon: UserPlus, tone: "bg-danger-soft text-danger", labelKey: "home.quickActions.enroll", to: "/enroll" } as const,
    { icon: Shirt, tone: "bg-success-soft text-success", labelKey: "home.quickActions.uniforms", to: "/uniforms" } as const,
    { icon: HeartHandshake, tone: "bg-info-soft text-info", labelKey: "home.quickActions.support", to: "/welfare" } as const,
    { icon: Compass, tone: "bg-violet-soft text-violet", labelKey: "home.quickActions.mission", to: "/mission" } as const,
  ];

  return (
    <div className="px-5 pt-6">
      <div className="mb-6">
        <p className="truncate text-[15px] font-bold text-foreground">
          {t("home.greeting")}, {youth?.full_name ?? "…"}
        </p>
        {youth?.cdm_id && (
          <span className="mt-1 inline-block rounded-full bg-danger-soft px-2 py-0.5 text-[10px] font-bold text-danger">
            {youth.cdm_id}
          </span>
        )}
      </div>

      <Link to="/enroll" className="mb-6 block rounded-2xl bg-warn-soft p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] font-bold text-foreground">
              {t("home.enrollBanner.title", { year: CURRENT_YEAR })}
            </p>
            <p className="mt-0.5 text-[11px] text-text-2">
              {enrollment?.status === "paid" || enrollment?.status === "waived"
                ? t("home.enrollBanner.enrolled")
                : t("home.enrollBanner.unenrolled")}
              {enrollment?.amount ? ` · Ksh ${enrollment.amount}` : ""}
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-warn" />
        </div>
      </Link>

      <div className="mb-6">
        <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-text-3">{t("home.quickActions")}</p>
        <div className="grid grid-cols-4 gap-2.5">
          {quickActions.map(({ icon: Icon, tone, labelKey, to }) => (
            <Link key={labelKey} to={to} className="flex flex-col items-center gap-1.5">
              <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${tone}`}>
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-center text-[10px] font-bold text-text-2">{t(labelKey)}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-wide text-text-3">{t("home.upcomingEvents")}</p>
          <Link to="/events" className="text-[11px] font-bold text-danger">{t("home.seeAll")}</Link>
        </div>
        {events && events.length > 0 ? (
          <div className="space-y-2.5">
            {events.map((ev) => (
              <Link
                key={ev.id}
                to="/events/$eventId"
                params={{ eventId: ev.id }}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5"
              >
                <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-danger-soft text-danger">
                  <span className="text-[9px] font-bold uppercase leading-none">
                    {ev.event_date ? new Date(ev.event_date).toLocaleDateString(undefined, { month: "short" }) : "—"}
                  </span>
                  <span className="text-[13px] font-black leading-none">
                    {ev.event_date ? new Date(ev.event_date).getDate() : "-"}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold text-foreground">{ev.name}</p>
                  {ev.venue && (
                    <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-text-3">
                      <MapPin className="h-3 w-3" /> {ev.venue}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-[12px] text-text-3">{t("home.noEvents")}</p>
        )}
      </div>

      <div className="pb-4">
        <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-text-3">{t("home.recentNotification")}</p>
        {notification ? (
          <Link to="/notifications" className="flex items-start gap-3 rounded-2xl border border-border bg-card p-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-info-soft text-info">
              <Bell className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-foreground">{notification.title}</p>
              {notification.body && <p className="mt-0.5 truncate text-[11px] text-text-3">{notification.body}</p>}
            </div>
          </Link>
        ) : (
          <p className="text-[12px] text-text-3">{t("home.noNotifications")}</p>
        )}
      </div>
    </div>
  );
}
