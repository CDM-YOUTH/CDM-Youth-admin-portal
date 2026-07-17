import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GraduationCap, Pencil, CalendarDays, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n/context";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authed/cusa")({
  head: () => ({ meta: [{ title: "CUSA Members Hub — CDM Youth Portal" }] }),
  component: CusaPage,
});

function CusaPage() {
  const { t } = useLanguage();
  const { youth } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [institution, setInstitution] = useState("");
  const [course, setCourse] = useState("");
  const [yearOfStudy, setYearOfStudy] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: membership } = useQuery({
    queryKey: ["cusa-membership", youth?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("cusa_members").select("*").eq("youth_id", youth!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!youth?.id,
  });

  const { data: events } = useQuery({
    queryKey: ["cusa-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, name, venue, event_date")
        .gte("event_date", new Date().toISOString())
        .order("event_date", { ascending: true })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const startEdit = () => {
    setInstitution(membership?.institution ?? "");
    setCourse(membership?.course ?? "");
    setYearOfStudy(membership?.year_of_study ?? "");
    setEditing(true);
  };

  const save = async () => {
    if (!youth) return;
    setSaving(true);
    try {
      const payload = { institution, course: course || null, year_of_study: yearOfStudy || null };
      const { error } = membership
        ? await supabase.from("cusa_members").update(payload).eq("id", membership.id)
        : await supabase.from("cusa_members").insert({ ...payload, youth_id: youth.id, year: new Date().getFullYear() });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["cusa-membership", youth.id] });
      toast.success(t("editProfile.saved"));
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  if (youth && youth.category !== "Tertiary" && !membership) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
        <GraduationCap className="mb-4 h-10 w-10 text-text-4" />
        <p className="text-[12px] text-text-3">{t("cusa.notCusa")}</p>
      </div>
    );
  }

  const isFinalYear = membership?.year_of_study?.toLowerCase().includes("final");

  return (
    <div className="px-5 pt-6 pb-6">
      <h1 className="text-display text-xl font-black text-foreground">{t("cusa.title")}</h1>

      <div className="mt-5 rounded-2xl border border-border bg-card p-4">
        <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-gold-3">
          <GraduationCap className="h-3.5 w-3.5" /> {t("cusa.currentInstitution")}
        </div>

        {editing ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="institution">{t("cusa.institution")}</Label>
              <Input id="institution" value={institution} onChange={(e) => setInstitution(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="course">{t("cusa.course")}</Label>
              <Input id="course" value={course} onChange={(e) => setCourse(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="yos">{t("cusa.yearOfStudy")}</Label>
              <Input id="yos" value={yearOfStudy} onChange={(e) => setYearOfStudy(e.target.value)} placeholder="e.g. Final Year" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={save} disabled={saving} className="flex-1">{saving ? t("common.loading") : t("common.save")}</Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)} className="flex-1">{t("common.cancel")}</Button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-[15px] font-bold text-foreground">{membership?.institution ?? "—"}</p>
            <div className="mt-1.5 flex gap-1.5">
              {membership?.year_of_study && (
                <span className="rounded-full bg-info-soft px-2.5 py-0.5 text-[10px] font-bold text-info">{membership.year_of_study}</span>
              )}
              {membership?.course && (
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-bold text-text-2">{membership.course}</span>
              )}
            </div>
            <button onClick={startEdit} className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-bold text-danger">
              <Pencil className="h-3.5 w-3.5" /> {t("cusa.updateDetails")}
            </button>
          </>
        )}
      </div>

      {isFinalYear && (
        <div className="mt-4 rounded-2xl bg-danger-soft p-4">
          <p className="text-[12px] font-semibold text-danger">{t("cusa.transitionBanner")}</p>
        </div>
      )}

      <div className="mt-6">
        <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-text-3">{t("cusa.events")}</p>
        <div className="space-y-2.5">
          {events?.map((ev) => (
            <div key={ev.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5">
              <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-violet-soft text-violet">
                <span className="text-[9px] font-bold uppercase leading-none">
                  {ev.event_date ? new Date(ev.event_date).toLocaleDateString(undefined, { month: "short" }) : "—"}
                </span>
                <span className="text-[13px] font-black leading-none">{ev.event_date ? new Date(ev.event_date).getDate() : "-"}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-foreground">{ev.name}</p>
                {ev.venue && (
                  <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-text-3">
                    <MapPin className="h-3 w-3" /> {ev.venue}
                  </p>
                )}
              </div>
            </div>
          ))}
          {(!events || events.length === 0) && (
            <p className="flex items-center gap-1.5 text-[12px] text-text-3">
              <CalendarDays className="h-3.5 w-3.5" /> {t("events.empty")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
