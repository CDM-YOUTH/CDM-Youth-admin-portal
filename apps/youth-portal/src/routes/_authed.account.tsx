import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronRight, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n/context";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authed/account")({
  head: () => ({ meta: [{ title: "Account — CDM Youth Portal" }] }),
  component: AccountPage,
});

function useLocalToggle(key: string, initial: boolean) {
  const [value, setValue] = useState(() => {
    if (typeof window === "undefined") return initial;
    const stored = window.localStorage.getItem(key);
    return stored === null ? initial : stored === "true";
  });
  const toggle = () => {
    setValue((v) => {
      const next = !v;
      window.localStorage.setItem(key, String(next));
      return next;
    });
  };
  return [value, toggle] as const;
}

function AccountPage() {
  const { t, lang, setLang } = useLanguage();
  const { youth } = useAuth();
  const navigate = useNavigate();
  const [changingPassword, setChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [notificationsEnabled, toggleNotifications] = useLocalToggle("cdm-youth-notifications", true);

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Password updated.");
      setChangingPassword(false);
      setNewPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update password.");
    } finally {
      setSaving(false);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <div className="px-5 pt-6">
      <div className="mb-6 flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft text-lg font-black text-danger">
          {youth?.full_name?.[0]?.toUpperCase() ?? "?"}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[14px] font-bold text-foreground">{youth?.full_name}</p>
          <p className="truncate text-[11px] text-text-3">{youth?.cdm_id}</p>
        </div>
      </div>

      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-text-3">{t("account.security")}</p>
      <div className="mb-6 rounded-2xl border border-border bg-card">
        <button
          onClick={() => setChangingPassword((v) => !v)}
          className="flex w-full items-center justify-between p-4 text-[13px] font-bold text-foreground"
        >
          {t("account.changePassword")}
          <ChevronRight className={cn("h-4 w-4 text-text-4 transition-transform", changingPassword && "rotate-90")} />
        </button>
        {changingPassword && (
          <form onSubmit={changePassword} className="space-y-3 border-t border-border p-4">
            <Input
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              required
            />
            <Button type="submit" disabled={saving} size="sm" className="w-full">
              {saving ? t("common.loading") : t("common.save")}
            </Button>
          </form>
        )}
      </div>

      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-text-3">{t("account.preferences")}</p>
      <div className="mb-6 space-y-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-bold text-foreground">{t("account.language")}</span>
          <div className="flex gap-1.5">
            {(["en", "sw"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={cn(
                  "rounded-full px-3 py-1 text-[11px] font-bold",
                  lang === l ? "bg-danger text-white" : "bg-muted text-text-3",
                )}
              >
                {l === "en" ? "English" : "Swahili"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-bold text-foreground">{t("account.notifications")}</span>
          <button
            onClick={toggleNotifications}
            className={cn(
              "relative h-6 w-11 rounded-full transition-colors",
              notificationsEnabled ? "bg-success" : "bg-border",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
                notificationsEnabled ? "translate-x-5" : "translate-x-0.5",
              )}
            />
          </button>
        </div>
      </div>

      <button
        onClick={logout}
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-danger py-3 text-[13px] font-bold text-danger"
      >
        <LogOut className="h-4 w-4" /> {t("account.logout")}
      </button>

      <div className="mt-8 text-center text-[10px] text-text-4">
        <p>{t("account.terms")} · {t("account.privacy")}</p>
      </div>
    </div>
  );
}
