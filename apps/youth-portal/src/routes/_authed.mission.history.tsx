import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, History, MapPin } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n/context";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authed/mission/history")({
  head: () => ({ meta: [{ title: "Mission History — CDM Youth Portal" }] }),
  component: MissionHistoryPage,
});

function MissionHistoryPage() {
  const { t } = useLanguage();
  const { youth } = useAuth();

  const { data: pairings } = useQuery({
    queryKey: ["mission-history", youth?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mission_pairings")
        .select("*, host_parish:parishes(name), host_deanery:deaneries(name), mission_week:mission_weeks(year)")
        .eq("youth_id", youth!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!youth?.id,
  });

  const completed = pairings?.filter((p) => p.status === "reported").length ?? 0;
  const parishes = new Set(pairings?.map((p) => p.host_parish?.name).filter(Boolean)).size;

  return (
    <div className="px-5 pt-6 pb-6">
      <Link to="/mission" className="mb-4 inline-flex items-center gap-1 text-[12px] font-semibold text-text-3">
        <ArrowLeft className="h-4 w-4" /> {t("common.back")}
      </Link>

      <h1 className="text-display text-xl font-black text-foreground">{t("mission.history")}</h1>
      <p className="mt-1 text-[12px] text-text-3">{t("mission.historySubtitle")}</p>

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl bg-danger-soft p-3.5 text-center">
          <p className="text-display text-2xl font-black text-danger">{String(completed).padStart(2, "0")}</p>
          <p className="text-[10px] font-bold text-danger/80">{t("mission.completed")}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-3.5 text-center">
          <p className="text-display text-2xl font-black text-foreground">{parishes}</p>
          <p className="text-[10px] font-bold text-text-3">Parishes Visited</p>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {(!pairings || pairings.length === 0) && (
          <div className="flex flex-col items-center py-16 text-center">
            <History className="mb-3 h-8 w-8 text-text-4" />
            <p className="text-[12px] text-text-3">{t("mission.noHistory")}</p>
          </div>
        )}
        {pairings?.map((p) => (
          <div key={p.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-black text-foreground">{p.mission_week?.year} Placement</p>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-bold text-text-2 capitalize">{p.status}</span>
            </div>
            <p className="mt-1.5 flex items-center gap-1 text-[12px] text-text-3">
              <MapPin className="h-3.5 w-3.5" /> {p.host_parish?.name ?? "—"} · {p.host_deanery?.name ?? "—"}
            </p>
            {p.report_summary && <p className="mt-2 text-[12px] text-text-2">{p.report_summary}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
