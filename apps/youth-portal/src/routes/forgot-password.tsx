import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { requestPasswordReset, confirmPasswordReset } from "@/rpc/auth";
import { useLanguage } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Forgot Password — CDM Youth Portal" }] }),
  component: ForgotPasswordPage,
});

type Step = "identity" | "reset";

function ForgotPasswordPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("identity");
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await requestPasswordReset({ data: identifier });
      setStep("reset");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      await confirmPasswordReset({ data: { identifier, code, newPassword } });
      await navigate({ to: "/login" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col bg-background px-6 py-8">
      <Link to="/login" className="mb-6 inline-flex items-center gap-1 text-[12px] font-semibold text-text-3">
        <ArrowLeft className="h-4 w-4" /> {t("common.back")}
      </Link>

      <div className="mb-6 flex flex-col items-center text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-danger-soft">
          <Lock className="h-7 w-7 text-danger" />
        </div>
        <h1 className="text-display text-2xl font-black text-foreground">{t("forgotPassword.title")}</h1>
        <p className="mt-2 text-[12px] text-text-3">{t("forgotPassword.subtitle")}</p>
      </div>

      <div className="mb-6 flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-wide">
        <span className={cn("rounded-full px-3 py-1", step === "identity" ? "bg-danger text-white" : "bg-success-soft text-success")}>
          {t("forgotPassword.stepIdentity")}
        </span>
        <span className="h-px w-6 bg-border" />
        <span className={cn("rounded-full px-3 py-1", step === "reset" ? "bg-danger text-white" : "bg-muted text-text-3")}>
          {t("forgotPassword.stepReset")}
        </span>
      </div>

      {step === "identity" ? (
        <form onSubmit={sendCode} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="identifier">{t("forgotPassword.identifier")}</Label>
            <Input
              id="identifier"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={t("forgotPassword.identifierPlaceholder")}
              required
            />
            <p className="text-[11px] text-text-3">{t("forgotPassword.helper")}</p>
          </div>
          {error && <div className="rounded-xl border border-danger/30 bg-danger-soft px-3.5 py-2.5 text-[12px] text-danger">{error}</div>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? t("common.loading") : `${t("forgotPassword.sendCode")} →`}
          </Button>
        </form>
      ) : (
        <form onSubmit={resetPassword} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="code">{t("forgotPassword.code")}</Label>
            <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder={t("forgotPassword.codePlaceholder")} required inputMode="numeric" maxLength={6} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="newPassword">{t("forgotPassword.newPassword")}</Label>
            <Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">{t("forgotPassword.confirmPassword")}</Label>
            <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} />
          </div>
          {error && <div className="rounded-xl border border-danger/30 bg-danger-soft px-3.5 py-2.5 text-[12px] text-danger">{error}</div>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? t("common.loading") : t("forgotPassword.resetSubmit")}
          </Button>
          <button
            type="button"
            onClick={() => setStep("identity")}
            className="w-full text-center text-[11px] font-semibold text-gold-3"
          >
            {t("forgotPassword.resendCode")}
          </button>
        </form>
      )}
    </main>
  );
}
