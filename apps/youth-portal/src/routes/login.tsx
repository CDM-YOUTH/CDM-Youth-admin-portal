import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { resolveLoginIdentifier } from "@/rpc/auth";
import { useLanguage } from "@/lib/i18n/context";
import cdmLogo from "@/assets/cdm-logo.jpeg";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign In — CDM Youth Portal" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { phone } = await resolveLoginIdentifier({ data: identifier });
      if (!phone) {
        setError(t("login.error.notFound"));
        return;
      }
      const { error: authError } = await supabase.auth.signInWithPassword({ phone, password });
      if (authError) throw authError;
      // Hard redirect (not router navigate()) so AuthProvider remounts and reads
      // the fresh session directly, instead of racing its own onAuthStateChange
      // update against the navigation.
      window.location.href = "/home";
    } catch (err) {
      setError(err instanceof Error ? err.message : t("login.error.generic"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center bg-background px-6 py-10">
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="mb-4 rounded-full bg-danger-soft p-2 ring-4 ring-gold/20">
          <img src={cdmLogo} alt="CDM Logo" className="h-24 w-24 object-contain" />
        </div>
        <h1 className="text-display text-2xl font-black text-danger">{t("login.welcomeBack")}</h1>
        <p className="mt-1 text-[12px] text-text-3">{t("login.subtitle")}</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="identifier">{t("login.identifier")}</Label>
          <Input
            id="identifier"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder={t("login.identifierPlaceholder")}
            required
            autoComplete="username"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">{t("login.password")}</Label>
            <Link to="/forgot-password" className="text-[11px] font-semibold text-gold-3">
              {t("login.forgotPassword")}
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="current-password"
          />
        </div>

        {error && (
          <div className="rounded-xl border border-danger/30 bg-danger-soft px-3.5 py-2.5 text-[12px] font-medium text-danger">
            {error}
          </div>
        )}

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? t("common.loading") : `${t("login.submit")} →`}
        </Button>
      </form>

      <p className="mt-6 text-center text-[12px] text-text-3">
        {t("login.noAccount")}{" "}
        <Link to="/register" className="font-bold text-danger">
          {t("login.registerLink")}
        </Link>
      </p>

      <div className="mt-10 text-center text-[10px] font-bold uppercase tracking-wide text-text-4">
        {t("login.secureBadge")}
      </div>
    </main>
  );
}
