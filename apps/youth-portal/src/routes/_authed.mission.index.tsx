import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Compass, MapPin, History } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n/context";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authed/mission/")({
  head: () => ({ meta: [{ title: "My Mission Week — CDM Youth Portal" }] }),
  component: MissionPage,
});

function MissionPage() {
  const { t } = useLanguage();
  const { youth } = useAuth();

  const { data: nominee } = useQuery({
    queryKey: ["mission-nominee", youth?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mission_nominees")
        .select("*, mission_week:mission_weeks(year, theme, status)")
        .eq("youth_id", youth!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!youth?.id,
  });

  const { data: pairing } = useQuery({
    queryKey: ["mission-pairing", youth?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mission_pairings")
        .select("*, host_parish:parishes(name), host_deanery:deaneries(name)")
        .eq("youth_id", youth!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!youth?.id,
  });

  return (
    <div className="px-5 pt-6 pb-6">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-display text-xl font-black text-foreground">{t("mission.title")}</h1>
        <Link to="/mission/history" className="flex items-center gap-1 text-[11px] font-bold text-danger">
          <History className="h-3.5 w-3.5" /> {t("mission.history")}
        </Link>
      </div>

      <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-text-3">{t("mission.currentStatus")}</p>

      {!nominee && !pairing && (
        <div className="flex flex-col items-center py-16 text-center">
          <Compass className="mb-3 h-8 w-8 text-text-4" />
          <p className="text-[12px] text-text-3">{t("mission.noAssignment")}</p>
        </div>
      )}

      {nominee && (
        <div className="mb-3 flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warn-soft text-warn">
            <Compass className="h-5 w-5" />
          </span>
          <div>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase",
                nominee.status === "confirmed" ? "bg-success-soft text-success" : "bg-warn-soft text-warn",
              )}
            >
              {nominee.status}
            </span>
            <p className="mt-1 text-[13px] font-bold text-foreground">
              {nominee.mission_week?.theme ?? `Mission Week ${nominee.mission_week?.year}`}
            </p>
          </div>
        </div>
      )}

      {pairing && (
        <div className="rounded-2xl border-2 border-danger bg-danger-soft p-4">
          <span className="rounded-full bg-white px-2.5 py-0.5 text-[10px] font-bold uppercase text-danger">{pairing.status}</span>
          <p className="mt-2 flex items-center gap-1.5 text-[14px] font-bold text-foreground">
            <MapPin className="h-4 w-4 text-danger" /> {pairing.host_parish?.name ?? pairing.host_deanery?.name ?? "TBA"}
          </p>

          <div className="mt-4 space-y-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-text-3">{t("mission.assignmentDetails")}</p>
            {pairing.host_deanery?.name && (
              <div className="flex items-center gap-2 text-[12px]">
                <MapPin className="h-3.5 w-3.5 text-text-3" />
                <span className="text-text-3">Deanery</span>
                <span className="ml-auto font-semibold">{pairing.host_deanery.name}</span>
              </div>
            )}
            {pairing.report_summary && (
              <div className="rounded-xl bg-white/60 p-3">
                <p className="text-[10px] font-bold uppercase text-text-3">{t("mission.viewReport")}</p>
                <p className="mt-1 text-[12px] text-text-2">{pairing.report_summary}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
