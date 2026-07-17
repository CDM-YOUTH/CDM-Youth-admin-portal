import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, ArrowLeft, ChevronDown, Check } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n/context";
import { supabase } from "@/integrations/supabase/client";
import { initiateStkPush } from "@/rpc/mpesa";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authed/enroll")({
  head: () => ({ meta: [{ title: "Enrollment — CDM Youth Portal" }] }),
  component: EnrollPage,
});

const ENROLLMENT_FEE = 100;
const CURRENT_YEAR = new Date().getFullYear();

function EnrollPage() {
  const { t } = useLanguage();
  const { youth, refreshYouth } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [showManual, setShowManual] = useState(false);
  const [paying, setPaying] = useState(false);
  const [enrollmentId, setEnrollmentId] = useState<string | null>(null);

  const { data: joined } = useQuery({
    queryKey: ["enroll-profile", youth?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("youths").select("*, parish:parishes(name)").eq("id", youth!.id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!youth?.id,
  });

  const { data: existing } = useQuery({
    queryKey: ["enrollment-current", youth?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("*")
        .eq("youth_id", youth!.id)
        .eq("year", CURRENT_YEAR)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!youth?.id,
  });

  const pay = async () => {
    if (!youth) return;
    setPaying(true);
    try {
      const { data, error } = await supabase
        .from("enrollments")
        .upsert(
          { youth_id: youth.id, year: CURRENT_YEAR, amount: ENROLLMENT_FEE, status: "pending", category: youth.category },
          { onConflict: "youth_id,year" },
        )
        .select("id")
        .single();
      if (error) throw error;
      setEnrollmentId(data.id);

      await initiateStkPush({
        data: {
          phone: youth.phone ?? "",
          amount: ENROLLMENT_FEE,
          accountRef: youth.cdm_id,
          description: `CDM Enrollment ${CURRENT_YEAR}`,
        },
      });

      await refreshYouth();
      setStep(3);
    } catch (err) {
      console.error(err);
    } finally {
      setPaying(false);
    }
  };

  if (existing && (existing.status === "paid" || existing.status === "waived")) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-success-soft">
          <Check className="h-8 w-8 text-success" />
        </div>
        <p className="text-[13px] font-semibold text-text-2">{t("enroll.alreadyEnrolled", { year: CURRENT_YEAR })}</p>
        <Link to="/home" className="mt-6 text-[12px] font-bold text-danger">{t("common.back")}</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-md bg-background px-5 py-6">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-display text-lg font-black text-foreground">{t("enroll.title")} — {CURRENT_YEAR}</p>
        <Link to="/home"><X className="h-5 w-5 text-text-3" /></Link>
      </div>

      <div className="mb-6 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide">
        {(["1", "2", "3"] as const).map((n, i) => (
          <span
            key={n}
            className={cn(
              "rounded-full px-3 py-1",
              step === i + 1 ? "bg-danger text-white" : step > i + 1 ? "bg-success-soft text-success" : "bg-muted text-text-3",
            )}
          >
            {t(`enroll.step${n}.label` as never)}
          </span>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-display text-lg font-black text-foreground">{t("enroll.review.title")}</h2>
            <p className="mt-1 text-[12px] text-text-3">{t("enroll.review.subtitle")}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <dl className="space-y-2 text-[13px]">
              <div className="flex justify-between"><dt className="text-text-3">{t("enroll.review.member")}</dt><dd className="font-semibold">{youth?.full_name}</dd></div>
              <div className="flex justify-between"><dt className="text-text-3">{t("enroll.review.parish")}</dt><dd className="font-semibold">{joined?.parish?.name ?? "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-text-3">{t("enroll.review.phone")}</dt><dd className="font-semibold">{youth?.phone}</dd></div>
              <div className="flex justify-between">
                <dt className="text-text-3">{t("enroll.review.category")}</dt>
                <dd className="flex items-center gap-1 font-semibold text-success">
                  <Check className="h-3.5 w-3.5" /> {youth?.category === "Tertiary" ? "CUSA" : youth?.category}
                </dd>
              </div>
            </dl>
          </div>
          <Button className="w-full" onClick={() => setStep(2)}>{t("enroll.review.continue")} →</Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <button onClick={() => setStep(1)} className="inline-flex items-center gap-1 text-[12px] font-semibold text-text-3">
            <ArrowLeft className="h-4 w-4" /> {t("common.back")}
          </button>
          <div>
            <h2 className="text-display text-lg font-black text-foreground">{t("enroll.payment.title")}</h2>
            <p className="mt-1 text-[12px] text-text-3">{t("enroll.payment.subtitle")}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4 text-center">
            <p className="text-[10px] font-bold uppercase tracking-wide text-text-3">{t("enroll.payment.amountDue")}</p>
            <p className="text-display mt-1 text-3xl font-black text-danger">Ksh {ENROLLMENT_FEE.toFixed(2)}</p>
          </div>
          <Button className="w-full" onClick={pay} disabled={paying}>
            {paying ? t("common.loading") : t("enroll.payment.payNow")}
          </Button>
          <div className="rounded-xl border border-border">
            <button
              onClick={() => setShowManual((v) => !v)}
              className="flex w-full items-center justify-between p-3.5 text-[12px] font-bold text-foreground"
            >
              {t("enroll.payment.manual")}
              <ChevronDown className={cn("h-4 w-4 transition-transform", showManual && "rotate-180")} />
            </button>
            {showManual && (
              <p className="border-t border-border p-3.5 text-[12px] leading-relaxed text-text-2">
                {t("enroll.payment.manualBody")}
              </p>
            )}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col items-center py-8 text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-success-soft">
            <Check className="h-8 w-8 text-success" />
          </div>
          <h2 className="text-display text-xl font-black text-foreground">{t("enroll.done.title")}</h2>
          <p className="mt-2 text-[13px] text-text-3">{t("enroll.done.body")}</p>
          <div className="mt-5 w-full rounded-2xl border border-border bg-card p-4">
            <dl className="space-y-2 text-[13px]">
              <div className="flex justify-between"><dt className="text-text-3">{t("enroll.done.reference")}</dt><dd className="font-mono font-semibold">{enrollmentId?.slice(0, 8).toUpperCase()}</dd></div>
              <div className="flex justify-between"><dt className="text-text-3">{t("enroll.done.amount")}</dt><dd className="font-semibold">Ksh {ENROLLMENT_FEE}</dd></div>
              <div className="flex justify-between">
                <dt className="text-text-3">{t("enroll.done.status")}</dt>
                <dd><span className="rounded-full bg-warn-soft px-2.5 py-0.5 text-[10px] font-bold text-warn">Pending</span></dd>
              </div>
            </dl>
          </div>
          <Button className="mt-6 w-full" onClick={() => navigate({ to: "/home" })}>{t("common.back")}</Button>
        </div>
      )}
    </div>
  );
}
