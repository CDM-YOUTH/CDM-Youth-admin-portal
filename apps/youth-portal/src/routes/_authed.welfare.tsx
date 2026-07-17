import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Brain, HeartPulse, Users, TreePine, GraduationCap, HeartHandshake, Check } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n/context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authed/welfare")({
  head: () => ({ meta: [{ title: "Welfare & Support — CDM Youth Portal" }] }),
  component: WelfarePage,
});

const CATEGORIES = [
  { value: "Mental Health", icon: Brain, tone: "bg-info-soft text-info", subtitle: "Safe space for your thoughts" },
  { value: "Recovery", icon: HeartPulse, tone: "bg-danger-soft text-danger", subtitle: "Support for addiction" },
  { value: "Family & Relationships", icon: Users, tone: "bg-success-soft text-success", subtitle: "Navigating home dynamics and conflict" },
  { value: "Faith Walk", icon: TreePine, tone: "bg-gold/20 text-gold-3", subtitle: "Spiritual counseling" },
  { value: "Future Path", icon: GraduationCap, tone: "bg-violet-soft text-violet", subtitle: "Career & school stress" },
] as const;

function WelfarePage() {
  const { t } = useLanguage();
  const { youth } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState<string>("");
  const [urgency, setUrgency] = useState<"low" | "medium" | "high">("medium");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const { data: cases } = useQuery({
    queryKey: ["welfare-cases", youth?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("welfare_cases")
        .select("id, case_ref, category, status, created_at")
        .eq("youth_id", youth!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!youth?.id,
  });

  const submit = async () => {
    if (!youth || !category) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("welfare_cases").insert({
        youth_id: youth.id,
        cdm_id: youth.cdm_id,
        category,
        urgency,
        notes: notes || null,
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["welfare-cases", youth.id] });
      setSubmitted(true);
      setShowForm(false);
      setCategory("");
      setNotes("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="px-5 pt-6 pb-6">
      <h1 className="text-display text-xl font-black text-foreground">{t("welfare.title")}</h1>
      <p className="mt-1 text-[12px] text-text-3">{t("welfare.subtitle")}</p>

      {submitted && (
        <div className="mt-4 rounded-2xl bg-success-soft p-4">
          <p className="flex items-center gap-2 text-[13px] font-bold text-success"><Check className="h-4 w-4" /> {t("welfare.submitted.title")}</p>
          <p className="mt-1 text-[12px] text-success/80">{t("welfare.submitted.body")}</p>
        </div>
      )}

      <Button className="mt-4 w-full" onClick={() => setShowForm((v) => !v)}>
        <HeartHandshake className="h-4 w-4" /> {t("welfare.submit")}
      </Button>

      {showForm && (
        <div className="mt-4 space-y-4 rounded-2xl border border-border bg-card p-4">
          <div className="space-y-1.5">
            <Label>{t("welfare.form.category")}</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue placeholder={t("welfare.form.category")} /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.value}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("welfare.form.urgency")}</Label>
            <div className="flex gap-2">
              {(["low", "medium", "high"] as const).map((u) => (
                <button
                  key={u}
                  onClick={() => setUrgency(u)}
                  className={cn(
                    "flex-1 rounded-xl border py-2 text-[12px] font-bold capitalize",
                    urgency === u ? "border-danger bg-danger-soft text-danger" : "border-border text-text-3",
                  )}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t("welfare.form.notes")}</Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full rounded-xl border border-border bg-white p-3 text-[13px] focus:outline-none focus:border-gold-3"
            />
          </div>
          <Button className="w-full" onClick={submit} disabled={!category || submitting}>
            {submitting ? t("common.loading") : t("welfare.form.submit")}
          </Button>
        </div>
      )}

      <div className="mt-6">
        <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-text-3">{t("welfare.categories")}</p>
        <div className="grid grid-cols-2 gap-2.5">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              onClick={() => { setCategory(c.value); setShowForm(true); }}
              className="rounded-2xl border border-border bg-card p-3.5 text-left"
            >
              <span className={cn("mb-2 flex h-9 w-9 items-center justify-center rounded-xl", c.tone)}>
                <c.icon className="h-4.5 w-4.5" />
              </span>
              <p className="text-[12px] font-bold text-foreground">{c.value}</p>
              <p className="mt-0.5 text-[10px] text-text-3">{c.subtitle}</p>
            </button>
          ))}
        </div>
      </div>

      {cases && cases.length > 0 && (
        <div className="mt-6">
          <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-text-3">{t("welfare.history")}</p>
          <div className="space-y-2">
            {cases.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
                <div>
                  <p className="text-[12px] font-bold text-foreground">{c.category}</p>
                  <p className="text-[10px] text-text-3">{c.case_ref}</p>
                </div>
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-bold text-text-2">{c.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
