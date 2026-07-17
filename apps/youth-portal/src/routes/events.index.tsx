import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, MapPin } from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { TopBar } from "@/components/top-bar";
import { useLanguage } from "@/lib/i18n/context";
import { supabase } from "@/integrations/supabase/client";
import type { Enums } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/events/")({
  head: () => ({ meta: [{ title: "Events — CDM Youth Portal" }] }),
  component: EventsListPage,
});

type ScopeFilter = "all" | Enums<"event_org_level">;

const SCOPE_TONE: Record<Enums<"event_org_level">, string> = {
  Diocese: "bg-danger-soft text-danger",
  Deanery: "bg-info-soft text-info",
  Parish: "bg-success-soft text-success",
  Outstation: "bg-violet-soft text-violet",
};

function EventsListPage() {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<ScopeFilter>("all");

  const { data: events } = useQuery({
    queryKey: ["events-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, name, venue, event_date, organization_level")
        .order("event_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const now = Date.now();
  const filtered = (events ?? []).filter((ev) => {
    if (scope !== "all" && ev.organization_level !== scope) return false;
    if (search && !ev.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  const upcoming = filtered.filter((ev) => !ev.event_date || new Date(ev.event_date).getTime() >= now);
  const past = filtered.filter((ev) => ev.event_date && new Date(ev.event_date).getTime() < now);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background">
      <TopBar />
      <div className="flex-1 px-5 pt-6">
        <h1 className="text-display text-xl font-black text-foreground">{t("events.title")}</h1>

        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-4" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("events.search")}
            className="h-11 w-full rounded-xl border border-border bg-white pl-9 pr-3 text-[13px] placeholder:text-text-4 focus:outline-none focus:border-gold-3"
          />
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto">
          {(["all", "Diocese", "Deanery", "Parish"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-1.5 text-[11px] font-bold",
                scope === s ? "bg-danger text-white" : "bg-muted text-text-3",
              )}
            >
              {s === "all" ? t("events.filter.all") : t(`events.filter.${s.toLowerCase()}` as never)}
            </button>
          ))}
        </div>

        {upcoming.length > 0 && (
          <div className="mt-5">
            <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-text-3">This Month</p>
            <div className="space-y-2.5">
              {upcoming.map((ev) => (
                <EventCard key={ev.id} event={ev} />
              ))}
            </div>
          </div>
        )}

        {past.length > 0 && (
          <div className="mt-5">
            <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-text-3">Past Events</p>
            <div className="space-y-2.5">
              {past.map((ev) => (
                <EventCard key={ev.id} event={ev} />
              ))}
            </div>
          </div>
        )}

        {filtered.length === 0 && <p className="mt-8 text-center text-[12px] text-text-3">{t("events.empty")}</p>}
      </div>
      <BottomNav />
    </div>
  );
}

function EventCard({
  event,
}: {
  event: { id: string; name: string; venue: string | null; event_date: string | null; organization_level: Enums<"event_org_level"> | null };
}) {
  const tone = event.organization_level ? SCOPE_TONE[event.organization_level] : "bg-muted text-text-3";
  return (
    <Link
      to="/events/$eventId"
      params={{ eventId: event.id }}
      className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5"
    >
      <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-danger-soft text-danger">
        <span className="text-[9px] font-bold uppercase leading-none">
          {event.event_date ? new Date(event.event_date).toLocaleDateString(undefined, { month: "short" }) : "—"}
        </span>
        <span className="text-[15px] font-black leading-none">
          {event.event_date ? new Date(event.event_date).getDate() : "-"}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        {event.organization_level && (
          <span className={cn("mb-1 inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase", tone)}>
            {event.organization_level}
          </span>
        )}
        <p className="truncate text-[13px] font-bold text-foreground">{event.name}</p>
        {event.venue && (
          <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-text-3">
            <MapPin className="h-3 w-3" /> {event.venue}
          </p>
        )}
      </div>
    </Link>
  );
}
