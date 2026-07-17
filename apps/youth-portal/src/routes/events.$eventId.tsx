import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Calendar, MapPin, Check } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n/context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/events/$eventId")({
  head: () => ({ meta: [{ title: "Event — CDM Youth Portal" }] }),
  component: EventDetailPage,
});

function EventDetailPage() {
  const { eventId } = Route.useParams();
  const { t } = useLanguage();
  const { youth, status } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const { data: event } = useQuery({
    queryKey: ["event", eventId],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").eq("id", eventId).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: myRsvp } = useQuery({
    queryKey: ["my-rsvp", eventId, youth?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_registrations")
        .select("id")
        .eq("event_id", eventId)
        .eq("youth_id", youth!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!youth?.id,
  });

  const toggleRsvp = async () => {
    if (status !== "authed") {
      navigate({ to: "/login" });
      return;
    }
    if (!youth) return;
    setBusy(true);
    try {
      if (myRsvp) {
        await supabase.from("event_registrations").delete().eq("id", myRsvp.id);
        toast.success(t("events.cancelRsvp"));
      } else {
        await supabase.from("event_registrations").insert({ event_id: eventId, youth_id: youth.id });
        toast.success(t("events.rsvp"));
      }
      queryClient.invalidateQueries({ queryKey: ["my-rsvp", eventId, youth.id] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  if (!event) return null;

  return (
    <div className="mx-auto min-h-screen max-w-md bg-background pb-28">
      <div className="flex items-center justify-between px-5 pt-6">
        <Link to="/events" className="inline-flex items-center gap-1 text-[12px] font-semibold text-text-3">
          <ArrowLeft className="h-4 w-4" /> {t("common.back")}
        </Link>
        {event.organization_level && (
          <span className="rounded-full bg-danger-soft px-2.5 py-0.5 text-[10px] font-bold text-danger">
            {event.organization_level}
          </span>
        )}
      </div>

      <div className="px-5 pt-4">
        <h1 className="text-display text-2xl font-black text-foreground">{event.name}</h1>

        <div className="mt-4 space-y-2.5">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5">
            <Calendar className="h-4 w-4 shrink-0 text-danger" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-text-3">{t("events.when")}</p>
              <p className="text-[13px] font-semibold text-foreground">
                {event.event_date ? new Date(event.event_date).toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" }) : "TBA"}
              </p>
            </div>
          </div>
          {event.venue && (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5">
              <MapPin className="h-4 w-4 shrink-0 text-danger" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-text-3">{t("events.where")}</p>
                <p className="text-[13px] font-semibold text-foreground">{event.venue}</p>
              </div>
            </div>
          )}
        </div>

        {event.description && (
          <div className="mt-5">
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-text-3">About</p>
            <p className="text-[13px] leading-relaxed text-text-2">{event.description}</p>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 mx-auto max-w-md border-t border-border bg-white p-4">
        <Button onClick={toggleRsvp} disabled={busy} className="w-full" variant={myRsvp ? "outline" : "default"}>
          {myRsvp ? (
            <>
              <Check className="h-4 w-4" /> {t("events.going")}
            </>
          ) : (
            t("events.rsvp")
          )}
        </Button>
      </div>
    </div>
  );
}
