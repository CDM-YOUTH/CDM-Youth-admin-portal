import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/lib/i18n/context";
import { useDeaneries, useParishes, useOutstations } from "@/lib/locations";
import { registerYouth } from "@/rpc/auth";
import { supabase } from "@/integrations/supabase/client";
import { normalizeKenyanPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";
import cdmLogo from "@/assets/cdm-logo.jpeg";

export const Route = createFileRoute("/register")({
  head: () => ({ meta: [{ title: "Register — CDM Youth Portal" }] }),
  component: RegisterPage,
});

type Category = "Secondary" | "Tertiary" | "Working" | "Other";

type FormState = {
  fullName: string;
  gender: "Male" | "Female";
  dateOfBirth: string;
  phone: string;
  email: string;
  deaneryId: string;
  parishId: string;
  outstationId: string;
  category: Category | "";
  password: string;
  confirmPassword: string;
};

const EMPTY: FormState = {
  fullName: "",
  gender: "Male",
  dateOfBirth: "",
  phone: "",
  email: "",
  deaneryId: "",
  parishId: "",
  outstationId: "",
  category: "",
  password: "",
  confirmPassword: "",
};

const CATEGORY_OPTIONS: { value: Category; labelKey: `register.category.${string}` }[] = [
  { value: "Secondary", labelKey: "register.category.Secondary" },
  { value: "Tertiary", labelKey: "register.category.CUSA" },
  { value: "Working", labelKey: "register.category.Working" },
  { value: "Other", labelKey: "register.category.Other" },
];

function StepDots({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="mb-6 flex gap-1.5">
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={cn("h-1.5 flex-1 rounded-full", n <= step ? "bg-danger" : "bg-border")}
        />
      ))}
    </div>
  );
}

function RegisterPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const { data: deaneries } = useDeaneries();
  const { data: parishes } = useParishes(form.deaneryId || undefined);
  const { data: outstations } = useOutstations(form.parishId || undefined);

  const deaneryName = deaneries?.find((d) => d.id === form.deaneryId)?.name;
  const parishName = parishes?.find((p) => p.id === form.parishId)?.name;

  const canSubmitStep1 = form.fullName.trim().length > 1 && form.dateOfBirth && form.phone.trim().length > 6;
  const canSubmitStep2 = !!form.deaneryId && !!form.parishId && !!form.category;
  const canSubmitStep3 = form.password.length >= 8 && form.password === form.confirmPassword;

  const [cdmId, setCdmId] = useState<string | null>(null);

  const submit = async () => {
    if (!form.category) return;
    setError(null);
    setLoading(true);
    try {
      const result = await registerYouth({
        data: {
          fullName: form.fullName,
          gender: form.gender,
          dateOfBirth: form.dateOfBirth,
          phone: form.phone,
          email: form.email,
          deaneryId: form.deaneryId,
          parishId: form.parishId,
          outstationId: form.outstationId,
          category: form.category,
          password: form.password,
        },
      });
      setCdmId(result.cdmId);
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        phone: normalizeKenyanPhone(form.phone) ?? form.phone,
        password: form.password,
      });
      if (!signInErr) {
        // Hard redirect so AuthProvider re-reads the session fresh on load,
        // rather than racing its onAuthStateChange update against navigate().
        setTimeout(() => { window.location.href = "/home"; }, 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (cdmId) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center bg-background px-6 text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-success-soft">
          <Check className="h-8 w-8 text-success" />
        </div>
        <h1 className="text-display text-2xl font-black text-foreground">{t("register.success.title")}</h1>
        <p className="mt-2 text-[13px] text-text-3">
          {t("register.success.body")} <span className="font-bold text-danger">{cdmId}</span>
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col bg-background px-6 py-8">
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => (step === 1 ? navigate({ to: "/" }) : setStep((s) => (s - 1) as 1 | 2))}
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-text-3"
        >
          <ArrowLeft className="h-4 w-4" /> {t("common.back")}
        </button>
        <img src={cdmLogo} alt="CDM" className="h-8 w-8 object-contain" />
      </div>

      <StepDots step={step} />
      <h1 className="text-display mb-1 text-xl font-black text-foreground">{t("register.title")}</h1>
      <p className="mb-6 text-[11px] font-bold uppercase tracking-wide text-gold-3">
        {step === 1 ? t("register.step1.label") : step === 2 ? t("register.step2.label") : t("register.step3.label")}
      </p>

      {step === 1 && (
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="fullName">{t("register.step1.fullName")}</Label>
            <Input id="fullName" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} required />
          </div>

          <div className="space-y-1.5">
            <Label>{t("register.step1.gender")}</Label>
            <div className="flex gap-2">
              {(["Male", "Female"] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => set("gender", g)}
                  className={cn(
                    "flex-1 rounded-xl border py-2.5 text-[13px] font-bold",
                    form.gender === g ? "border-danger bg-danger-soft text-danger" : "border-border text-text-3",
                  )}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dob">{t("register.step1.dob")}</Label>
            <Input id="dob" type="date" value={form.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone">{t("register.step1.phone")}</Label>
            <Input id="phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="0712 345 678" required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">{t("register.step1.email")}</Label>
            <Input id="email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="you@example.com" />
          </div>

          <Button className="w-full" disabled={!canSubmitStep1} onClick={() => setStep(2)}>
            {t("common.next")} →
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <div className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-text-3">{t("register.step2.ecclesiastical")}</p>

            <div className="space-y-1.5">
              <Label>{t("register.step2.deanery")}</Label>
              <Select value={form.deaneryId} onValueChange={(v) => { set("deaneryId", v); set("parishId", ""); set("outstationId", ""); }}>
                <SelectTrigger><SelectValue placeholder={t("register.step2.deaneryPlaceholder")} /></SelectTrigger>
                <SelectContent>
                  {deaneries?.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{t("register.step2.parish")}</Label>
              <Select value={form.parishId} onValueChange={(v) => { set("parishId", v); set("outstationId", ""); }} disabled={!form.deaneryId}>
                <SelectTrigger><SelectValue placeholder={t("register.step2.parishPlaceholder")} /></SelectTrigger>
                <SelectContent>
                  {parishes?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{t("register.step2.outstation")}</Label>
              <Select value={form.outstationId} onValueChange={(v) => set("outstationId", v)} disabled={!form.parishId}>
                <SelectTrigger><SelectValue placeholder={t("register.step2.outstationPlaceholder")} /></SelectTrigger>
                <SelectContent>
                  {outstations?.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-text-3">{t("register.step2.category")}</p>
            <div className="grid grid-cols-2 gap-2.5">
              {CATEGORY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => set("category", opt.value)}
                  className={cn(
                    "rounded-xl border py-3 text-[13px] font-bold",
                    form.category === opt.value ? "border-danger bg-danger-soft text-danger" : "border-border text-text-3",
                  )}
                >
                  {t(opt.labelKey as never)}
                </button>
              ))}
            </div>
          </div>

          <Button className="w-full" disabled={!canSubmitStep2} onClick={() => setStep(3)}>
            {t("common.next")} →
          </Button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-display text-lg font-black text-foreground">{t("register.step3.title")}</h2>
            <p className="mt-1 text-[12px] text-text-3">{t("register.step3.subtitle")}</p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-gold-3">{t("register.step3.personal")}</p>
            <dl className="space-y-1 text-[13px]">
              <div className="flex justify-between"><dt className="text-text-3">{t("register.step1.fullName")}</dt><dd className="font-semibold">{form.fullName}</dd></div>
              <div className="flex justify-between"><dt className="text-text-3">{t("register.step1.phone")}</dt><dd className="font-semibold">{form.phone}</dd></div>
              {form.email && <div className="flex justify-between"><dt className="text-text-3">{t("register.step1.email")}</dt><dd className="font-semibold">{form.email}</dd></div>}
            </dl>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-gold-3">{t("register.step3.ecclesial")}</p>
            <dl className="space-y-1 text-[13px]">
              <div className="flex justify-between"><dt className="text-text-3">{t("register.step2.parish")}</dt><dd className="font-semibold">{parishName ?? "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-text-3">{t("register.step2.deanery")}</dt><dd className="font-semibold">{deaneryName ?? "—"}</dd></div>
            </dl>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">{t("register.step3.password")}</Label>
            <Input id="password" type="password" value={form.password} onChange={(e) => set("password", e.target.value)} minLength={8} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">{t("register.step3.confirmPassword")}</Label>
            <Input id="confirmPassword" type="password" value={form.confirmPassword} onChange={(e) => set("confirmPassword", e.target.value)} minLength={8} required />
          </div>

          <p className="rounded-xl bg-warn-soft px-3.5 py-2.5 text-[11px] font-medium text-warn">{t("register.step3.note")}</p>

          {error && <div className="rounded-xl border border-danger/30 bg-danger-soft px-3.5 py-2.5 text-[12px] text-danger">{error}</div>}

          <Button className="w-full" disabled={!canSubmitStep3 || loading} onClick={submit}>
            {loading ? t("common.loading") : t("register.step3.submit")}
          </Button>
        </div>
      )}
    </main>
  );
}
