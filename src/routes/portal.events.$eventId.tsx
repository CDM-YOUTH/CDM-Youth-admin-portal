import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarDays, MapPin, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { getEventFull } from "@/lib/db/events";
import { getMyYouth, registerMeForEvent } from "@/lib/db/portal";

export const Route = createFileRoute("/portal/events/$eventId")({
  component: EventDetail,
});

function EventDetail() {
  const { eventId } = Route.useParams();
  const navigate = useNavigate();
  const [registering, setRegistering] = useState(false);

  const event = useQuery({
    queryKey: ["portal", "event", eventId],
    queryFn: () => getEventFull(eventId),
  });

  const me = useQuery({ queryKey: ["portal", "me"], queryFn: getMyYouth });

  if (event.isLoading) {
    return <p className="px-5 pt-10 text-center text-[12px] text-text-3">Loading…</p>;
  }
  if (event.error || !event.data) {
    return <p className="px-5 pt-10 text-center text-[12px] text-danger">Event not found</p>;
  }
  const e = event.data;
  const alreadyRegistered =
    me.data && e.registrations.some((r) => r.youth?.cdm_id === me.data?.cdm_id);

  return (
    <div className="px-5 pt-6">
      <Link
        to="/portal/events"
        className="mb-3 inline-flex items-center gap-1 text-[11px] font-semibold text-text-3 hover:text-danger"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All events
      </Link>

      <h1 className="text-display text-xl font-extrabold text-foreground">{e.name}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px] text-text-2">
        {e.event_date && (
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" />
            {new Date(e.event_date).toLocaleDateString(undefined, {
              weekday: "short",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
        )}
        {e.venue && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" /> {e.venue}
          </span>
        )}
      </div>

      {e.description && (
        <p className="mt-4 rounded-2xl border border-border bg-white p-4 text-[13px] leading-relaxed text-text-1">
          {e.description}
        </p>
      )}

      {e.program.length > 0 && (
        <section className="mt-5">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-gold-3">Programme</h2>
          <ol className="mt-2 space-y-2">
            {e.program.map((p) => (
              <li
                key={p.id}
                className="flex items-start gap-3 rounded-xl border border-border bg-white px-3 py-2 text-[12px]"
              >
                <span className="font-bold text-danger">
                  {p.start_time?.slice(0, 5) ?? "—"}
                </span>
                <span className="text-text-1">{p.activity}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="mt-6">
        {!me.data ? (
          <Link
            to="/portal/auth"
            search={{ mode: "signin" }}
            className="block w-full rounded-2xl bg-danger py-3.5 text-center text-[14px] font-bold text-white"
          >
            Sign in to register
          </Link>
        ) : alreadyRegistered ? (
          <div className="rounded-2xl border border-success/30 bg-success-soft py-3 text-center text-[13px] font-bold text-success">
            ✓ You're registered
          </div>
        ) : (
          <button
            disabled={registering}
            onClick={async () => {
              if (!me.data) return;
              setRegistering(true);
              try {
                await registerMeForEvent(eventId, me.data);
                toast.success("You're registered");
                await event.refetch();
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Failed to register");
              } finally {
                setRegistering(false);
              }
            }}
            className="w-full rounded-2xl bg-danger py-3.5 text-[14px] font-bold text-white disabled:opacity-60"
          >
            {registering ? "Registering…" : "Register for this event"}
          </button>
        )}
      </div>

      <p className="mt-3 text-center text-[10px] text-text-3">
        {e.registrations.length} registered · {e.checkin_count} checked in
      </p>

      <button
        type="button"
        onClick={() => navigate({ to: "/portal/events" })}
        className="sr-only"
      >
        back
      </button>
    </div>
  );
}