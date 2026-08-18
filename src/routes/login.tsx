import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import cdmLogo from "@/assets/cdm-logo.jpeg";

const loginSearchSchema = z.object({
  redirect: fallback(z.string(), "/admin/dashboard").default("/admin/dashboard"),
});

export const Route = createFileRoute("/login")({
  validateSearch: zodValidator(loginSearchSchema),
  head: () => ({
    meta: [{ title: "Login — CDM Youth Office" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { redirect: redirectTo } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const handleForgotPassword = async () => {
    setError(null);
    setMessage(null);
    if (!email) {
      setError("Enter your email address above first, then click Forgot your password.");
      return;
    }
    setResetting(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/set-password`,
      });
      if (resetError) throw resetError;
      setMessage("Password reset email sent — check your inbox.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not send reset email. Please try again.",
      );
    } finally {
      setResetting(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (authError) throw authError;
      // Navigate to the page the user was trying to reach, or /admin by default
      await navigate({ to: (redirectTo || "/admin/dashboard") as "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen overflow-hidden bg-white">
      {/* Left branding panel — visible on lg+ */}
      <div
        className="relative hidden flex-col items-center justify-center p-12 lg:flex lg:w-[45%]"
        style={{
          background: "linear-gradient(155deg, var(--color-danger) 0%, var(--color-gold-3) 100%)",
        }}
      >
        {/* Decorative circles */}
        <div className="absolute left-12 top-12 h-40 w-40 rounded-full border border-white/15" />
        <div className="absolute bottom-24 right-8 h-56 w-56 rounded-full border border-white/10" />
        <div className="absolute right-20 top-1/3 h-20 w-20 rounded-full bg-white/5" />
        <div className="absolute bottom-40 left-8 h-12 w-12 rounded-full bg-white/8" />

        {/* Logo */}
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
          <div className="inline-block rounded-full border border-white/25 bg-white/10 px-5 py-2 text-[12px] font-bold italic text-white/90 backdrop-blur-sm">
            "Youth — The hope of the church"
          </div>
        </div>

        {/* Mini stats */}
        <div className="mt-12 grid w-full max-w-[240px] grid-cols-2 gap-3">
          {[
            ["8", "Deaneries"],
            ["56+", "Parishes"],
          ].map(([v, l]) => (
            <div
              key={l}
              className="rounded-xl border border-white/20 bg-white/10 p-3 text-center backdrop-blur-sm"
            >
              <div className="text-display text-xl font-black text-white">{v}</div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-white/70">{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 flex-col items-center justify-center p-6 lg:p-12">
        {/* Mobile logo */}
        <div className="mb-8 flex flex-col items-center lg:hidden">
          <div className="mb-4 rounded-full bg-danger-soft p-2 ring-4 ring-gold/20">
            <img src={cdmLogo} alt="CDM Logo" className="h-28 w-28 object-contain" />
          </div>
          <div className="text-center">
            <div className="text-[11px] font-bold text-gold">Catholic Diocese of Murang'a</div>
            <div className="text-[9px] text-text-3">Youth Office Management System</div>
          </div>
        </div>

        <div className="w-full max-w-md">
          {/* Back link */}
          <Link
            to="/"
            className="mb-8 inline-flex items-center gap-1 text-[11px] font-semibold text-text-3 transition-colors hover:text-danger"
          >
            ← Back to Home
          </Link>

          <div className="mb-8 mt-3">
            <h1 className="text-display text-3xl font-black text-danger">Admin Login</h1>
            <p className="mt-2 text-[12px] text-text-3">
              Sign in to the Youth Office Management System
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-[10px] font-bold uppercase tracking-wide text-gold-3"
              >
                Email address
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@cdmyouth.co.ke"
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block text-[10px] font-bold uppercase tracking-wide text-gold-3"
              >
                Password
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
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

            {error && (
              <div className="rounded-lg border border-danger/30 bg-danger-soft px-3.5 py-2.5 text-[12px] font-medium text-danger">
                {error}
              </div>
            )}

            {message && (
              <div className="rounded-lg border border-success/30 bg-success-soft px-3.5 py-2.5 text-[12px] font-medium text-success">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-danger py-3.5 text-[14px] font-bold text-white shadow-md transition-all hover:opacity-90 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Sign In →"}
            </button>
          </form>

          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={resetting}
              className="text-[11px] text-text-3 transition-colors hover:text-gold disabled:opacity-60"
            >
              {resetting ? "Sending…" : "Forgot your password?"}
            </button>
          </div>

          <div className="mt-12 border-t border-border pt-5 text-center text-[10px] text-text-4">
            Catholic Diocese of Murang'a · Youth Office
          </div>
        </div>
      </div>
    </main>
  );
}
