import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pencil, Phone, MapPin, Copy } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n/context";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authed/profile/")({
  head: () => ({ meta: [{ title: "My Profile — CDM Youth Portal" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { t } = useLanguage();
  const { youth } = useAuth();
  const [tab, setTab] = useState<"details" | "history">("details");

  const { data: joined } = useQuery({
    queryKey: ["profile-joined", youth?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("youths")
        .select("*, deanery:deaneries(name), parish:parishes(name), outstation:outstations(name)")
        .eq("id", youth!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!youth?.id,
  });

  const { data: enrollments } = useQuery({
    queryKey: ["enrollment-history", youth?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("id, year, status, amount")
        .eq("youth_id", youth!.id)
        .order("year", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!youth?.id,
  });

  return (
    <div className="px-5 pt-6">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-danger-soft text-3xl font-black text-danger">
          {youth?.full_name?.[0]?.toUpperCase() ?? "?"}
        </div>
        <p className="mt-3 text-[16px] font-black text-foreground">{youth?.full_name}</p>
        <div className="mt-2 flex items-center gap-1.5">
          {youth?.cdm_id && (
            <span className="rounded-full bg-danger px-2.5 py-0.5 text-[10px] font-bold text-white">{youth.cdm_id}</span>
          )}
          {youth?.category === "Tertiary" ? (
            <Link to="/cusa" className="rounded-full bg-violet-soft px-2.5 py-0.5 text-[10px] font-bold text-violet">
              CUSA
            </Link>
          ) : youth?.category ? (
            <span className="rounded-full bg-violet-soft px-2.5 py-0.5 text-[10px] font-bold text-violet">
              {youth.category}
            </span>
          ) : null}
        </div>
        <Link
          to="/profile/edit"
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-[12px] font-bold text-foreground"
        >
          <Pencil className="h-3.5 w-3.5" /> {t("profile.editProfile")}
        </Link>
      </div>

      <div className="mt-6 flex gap-4 border-b border-border">
        {(["details", "history"] as const).map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "border-b-2 pb-2.5 text-[12px] font-bold",
              tab === key ? "border-danger text-danger" : "border-transparent text-text-3",
            )}
          >
            {key === "details" ? t("profile.details") : t("profile.enrollmentHistory")}
          </button>
        ))}
      </div>

      {tab === "details" ? (
        <div className="mt-5 space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-gold-3">{t("profile.affiliation")}</p>
            <dl className="space-y-2 text-[13px]">
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-text-3" />
                <dt className="text-text-3">{t("profile.deanery")}</dt>
                <dd className="ml-auto font-semibold">{joined?.deanery?.name ?? "—"}</dd>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-text-3" />
                <dt className="text-text-3">{t("profile.parish")}</dt>
                <dd className="ml-auto font-semibold">{joined?.parish?.name ?? "—"}</dd>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-text-3" />
                <dt className="text-text-3">{t("profile.outstation")}</dt>
                <dd className="ml-auto font-semibold">{joined?.outstation?.name ?? "—"}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-gold-3">{t("profile.contact")}</p>
            <div className="flex items-center gap-2 text-[13px]">
              <Phone className="h-3.5 w-3.5 text-text-3" />
              <span className="text-text-3">{t("profile.phone")}</span>
              <span className="ml-auto font-semibold">{youth?.phone ?? "—"}</span>
              {youth?.phone && (
                <button onClick={() => navigator.clipboard.writeText(youth.phone!)} className="text-text-4">
                  <Copy className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-5 space-y-2.5">
          {enrollments && enrollments.length > 0 ? (
            enrollments.map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded-2xl border border-border bg-card p-3.5">
                <span className="text-[13px] font-bold text-foreground">{e.year}</span>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-[10px] font-bold",
                    e.status === "paid" || e.status === "waived" ? "bg-success-soft text-success" : "bg-warn-soft text-warn",
                  )}
                >
                  {e.status}
                </span>
              </div>
            ))
          ) : (
            <p className="text-[12px] text-text-3">{t("profile.noEnrollments")}</p>
          )}
        </div>
      )}
    </div>
  );
}
