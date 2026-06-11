import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, MapPin, ChevronRight } from "lucide-react";
import { listUpcomingEvents } from "@/lib/db/portal";

export const Route = createFileRoute("/portal/events")({
  component: EventsPage,
});

function EventsPage() {
  const events = useQuery({ queryKey: ["portal", "events"], queryFn: listUpcomingEvents });

  return (
    <div className="px-5 pt-6">
      <h1 className="text-display text-xl font-extrabold text-danger">Upcoming Events</h1>
      <p className="mt-1 text-[12px] text-text-3">Diocesan activities you can join.</p>

      <div className="mt-5 space-y-3">
        {events.isLoading && <p className="text-[12px] text-text-3">Loading…</p>}
        {events.data?.length === 0 && (
          <p className="text-[12px] text-text-3">No upcoming events yet — check back soon.</p>
        )}
        {events.data?.map((e) => (
          <Link
            key={e.id}
            to="/portal/events/$eventId"
            params={{ eventId: e.id }}
            className="block rounded-2xl border border-border bg-white p-4 shadow-sm transition-colors hover:border-gold/40"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="text-[13px] font-bold text-foreground">{e.name}</div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-text-3">
                  {e.event_date && (
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {new Date(e.event_date).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  )}
                  {e.venue && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {e.venue}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {e.organization_level && (
                    <span className="rounded-full bg-danger-soft px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-danger">
                      {e.organization_level}
                    </span>
                  )}
                  {e.parish?.name && (
                    <span className="rounded-full bg-warn-soft px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-gold-3">
                      {e.parish.name}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="mt-1 h-4 w-4 text-text-3" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}