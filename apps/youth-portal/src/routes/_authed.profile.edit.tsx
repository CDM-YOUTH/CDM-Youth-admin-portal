import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n/context";
import { useDeaneries, useParishes, useOutstations } from "@/lib/locations";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authed/profile/edit")({
  head: () => ({ meta: [{ title: "Edit Profile — CDM Youth Portal" }] }),
  component: EditProfilePage,
});

function EditProfilePage() {
  const { t } = useLanguage();
  const { youth, refreshYouth } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState(youth?.full_name ?? "");
  const [gender, setGender] = useState<"Male" | "Female">(youth?.gender ?? "Male");
  const [age, setAge] = useState(String(youth?.age ?? ""));
  const [phone, setPhone] = useState(youth?.phone ?? "");
  const [email, setEmail] = useState(youth?.email ?? "");
  const [deaneryId, setDeaneryId] = useState(youth?.deanery_id ?? "");
  const [parishId, setParishId] = useState(youth?.parish_id ?? "");
  const [outstationId, setOutstationId] = useState(youth?.outstation_id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: deaneries } = useDeaneries();
  const { data: parishes } = useParishes(deaneryId || undefined);
  const { data: outstations } = useOutstations(parishId || undefined);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!youth) return;
    setError(null);
    setSaving(true);
    try {
      const { error: updateErr } = await supabase
        .from("youths")
        .update({
          full_name: fullName,
          gender,
          age: Number(age),
          phone,
          email: email || null,
          deanery_id: deaneryId || null,
          parish_id: parishId || null,
          outstation_id: outstationId || null,
        })
        .eq("id", youth.id);
      if (updateErr) throw updateErr;
      await refreshYouth();
      toast.success(t("editProfile.saved"));
      navigate({ to: "/profile" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-5 pt-6">
      <button onClick={() => navigate({ to: "/profile" })} className="mb-6 inline-flex items-center gap-1 text-[12px] font-semibold text-text-3">
        <ArrowLeft className="h-4 w-4" /> {t("common.back")}
      </button>

      <h1 className="text-display mb-6 text-xl font-black text-foreground">{t("editProfile.title")}</h1>

      <form onSubmit={save} className="space-y-5 pb-8">
        <p className="text-[11px] font-bold uppercase tracking-wide text-text-3">{t("editProfile.personal")}</p>

        <div className="space-y-1.5">
          <Label htmlFor="fullName">{t("register.step1.fullName")}</Label>
          <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </div>

        <div className="space-y-1.5">
          <Label>{t("register.step1.gender")}</Label>
          <div className="flex gap-2">
            {(["Male", "Female"] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGender(g)}
                className={cn(
                  "flex-1 rounded-xl border py-2.5 text-[13px] font-bold",
                  gender === g ? "border-danger bg-danger-soft text-danger" : "border-border text-text-3",
                )}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="age">{t("editProfile.age")}</Label>
          <Input id="age" type="number" min={0} max={120} value={age} onChange={(e) => setAge(e.target.value)} required />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone">{t("register.step1.phone")}</Label>
          <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">{t("register.step1.email")}</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        <p className="pt-2 text-[11px] font-bold uppercase tracking-wide text-text-3">{t("editProfile.ecclesial")}</p>

        <div className="space-y-1.5">
          <Label>{t("register.step2.deanery")}</Label>
          <Select value={deaneryId} onValueChange={(v) => { setDeaneryId(v); setParishId(""); setOutstationId(""); }}>
            <SelectTrigger><SelectValue placeholder={t("register.step2.deaneryPlaceholder")} /></SelectTrigger>
            <SelectContent>{deaneries?.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>{t("register.step2.parish")}</Label>
          <Select value={parishId} onValueChange={(v) => { setParishId(v); setOutstationId(""); }} disabled={!deaneryId}>
            <SelectTrigger><SelectValue placeholder={t("register.step2.parishPlaceholder")} /></SelectTrigger>
            <SelectContent>{parishes?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>{t("register.step2.outstation")}</Label>
          <Select value={outstationId} onValueChange={setOutstationId} disabled={!parishId}>
            <SelectTrigger><SelectValue placeholder={t("register.step2.outstationPlaceholder")} /></SelectTrigger>
            <SelectContent>{outstations?.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        {error && <div className="rounded-xl border border-danger/30 bg-danger-soft px-3.5 py-2.5 text-[12px] text-danger">{error}</div>}

        <Button type="submit" disabled={saving} className="w-full">
          {saving ? t("common.loading") : t("common.save")}
        </Button>
      </form>
    </div>
  );
}
