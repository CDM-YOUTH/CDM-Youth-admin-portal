import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import cdmLogo from "@/assets/cdm-logo.jpeg";

export const Route = createFileRoute("/set-password")({
  head: () => ({
    meta: [{ title: "Set Password — CDM Youth Office" }],
  }),
  component: SetPasswordPage,
});

function SetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    // Fallback in case the auth event already fired before this listener attached.
    const timeout = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) setReady(true);
      else setInvalid(true);
    }, 2500);
    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      await navigate({ to: "/admin/dashboard" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not set password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen overflow-hidden bg-white">
      <div
        className="relative hidden flex-col items-center justify-center p-12 lg:flex lg:w-[45%]"
        style={{
          background: "linear-gradient(155deg, var(--color-danger) 0%, var(--color-gold-3) 100%)",
        }}
      >
        <div className="absolute left-12 top-12 h-40 w-40 rounded-full border border-white/15" />
        <div className="absolute bottom-24 right-8 h-56 w-56 rounded-full border border-white/10" />

        <div className="relative mb-8">
          <div className="absolute inset-0 scale-[1.5] rounded-full bg-white/10 blur-2xl" />
          <div className="relative rounded-full bg-white/15 p-3 ring-2 ring-white/25 backdrop-blur-sm">
            <img
              src={cdmLogo}
              alt="Catholic Diocese of Murang'a Youth"
              className="h-52 w-52 object-contain drop-shadow-2xl"
            />
          </div>
        </div>

        <div className="text-center">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-white/75">
            Catholic Diocese of Murang'a
          </div>
          <div className="text-display text-2xl font-black text-white">Youth Office</div>
          <div className="mb-6 text-lg font-semibold text-white/90">Management System</div>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center p-6 lg:p-12">
        <div className="mb-8 flex flex-col items-center lg:hidden">
          <div className="mb-4 rounded-full bg-danger-soft p-2 ring-4 ring-gold/20">
            <img src={cdmLogo} alt="CDM Logo" className="h-28 w-28 object-contain" />
          </div>
        </div>

        <div className="w-full max-w-md">
          <div className="mb-8 mt-3">
            <h1 className="text-display text-3xl font-black text-danger">Set Your Password</h1>
            <p className="mt-2 text-[12px] text-text-3">
              Choose a password to activate your account.
            </p>
          </div>

          {invalid ? (
            <div className="rounded-lg border border-danger/30 bg-danger-soft px-3.5 py-3 text-[12px] font-medium text-danger">
              This link is invalid or has expired — ask an admin to resend your invite.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label
                  htmlFor="password"
                  className="block text-[10px] font-bold uppercase tracking-wide text-gold-3"
                >
                  New password
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="new-password"
                    disabled={!ready}
                    className="pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-text-3 transition-colors hover:text-danger"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="confirm"
                  className="block text-[10px] font-bold uppercase tracking-wide text-gold-3"
                >
                  Confirm password
                </label>
                <Input
                  id="confirm"
                  type={showPassword ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                  disabled={!ready}
                />
              </div>

              {error && (
                <div className="rounded-lg border border-danger/30 bg-danger-soft px-3.5 py-2.5 text-[12px] font-medium text-danger">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={!ready || loading}
                className="w-full rounded-xl bg-danger py-3.5 text-[14px] font-bold text-white shadow-md transition-all hover:opacity-90 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
              >
                {!ready ? "Verifying link…" : loading ? "Saving…" : "Set Password & Sign In →"}
              </button>
            </form>
          )}

          <div className="mt-12 border-t border-border pt-5 text-center text-[10px] text-text-4">
            Catholic Diocese of Murang'a · Youth Office
          </div>
        </div>
      </div>
    </main>
  );
}
