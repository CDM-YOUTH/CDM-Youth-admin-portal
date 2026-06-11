import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import cdmLogo from "@/assets/cdm-logo.jpeg";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup"]).default("signin").catch("signin"),
});

export const Route = createFileRoute("/portal/auth")({
  validateSearch: searchSchema,
  component: AuthPage,
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const isSignup = mode === "signup";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMsg(null);
    setLoading(true);
    try {
      if (isSignup) {
        const { error: signupErr } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/portal`,
            data: { full_name: fullName },
          },
        });
        if (signupErr) throw signupErr;
        const { data: u } = await supabase.auth.getUser();
        if (u.user) {
          await navigate({ to: "/portal/account" });
        } else {
          setMsg("Check your email to confirm your account, then sign in.");
        }
      } else {
        const { error: signinErr } = await supabase.auth.signInWithPassword({ email, password });
        if (signinErr) throw signinErr;
        await navigate({ to: "/portal/account" });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-5 pt-8">
      <div className="mb-6 flex flex-col items-center">
        <img src={cdmLogo} alt="CDM" className="h-24 w-24 rounded-full object-contain" />
        <h1 className="mt-4 text-display text-2xl font-black text-danger">
          {isSignup ? "Create Account" : "Welcome Back"}
        </h1>
        <p className="mt-1 text-[12px] text-text-3">
          {isSignup ? "Join the Diocese of Murang'a youth" : "Sign in to your Diocese portal"}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {isSignup && (
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold uppercase tracking-wide text-gold-3">
              Full name
            </label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Mary Wanjiku"
              required
              autoComplete="name"
            />
          </div>
        )}

        <div className="space-y-1.5">
          <label className="block text-[10px] font-bold uppercase tracking-wide text-gold-3">
            Email
          </label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-[10px] font-bold uppercase tracking-wide text-gold-3">
            Password
          </label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            minLength={6}
            autoComplete={isSignup ? "new-password" : "current-password"}
          />
        </div>

        {error && (
          <div className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-[12px] font-medium text-danger">
            {error}
          </div>
        )}
        {msg && (
          <div className="rounded-lg border border-success/30 bg-success-soft px-3 py-2 text-[12px] font-medium text-success">
            {msg}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl bg-danger py-3.5 text-[14px] font-bold text-white shadow-md transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "Please wait…" : isSignup ? "Create account →" : "Sign In →"}
        </button>
      </form>

      <div className="mt-5 text-center text-[12px] text-text-3">
        {isSignup ? (
          <>
            Already a member?{" "}
            <Link to="/portal/auth" search={{ mode: "signin" }} className="font-bold text-danger">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link to="/portal/auth" search={{ mode: "signup" }} className="font-bold text-success">
              Register
            </Link>
          </>
        )}
      </div>

      <div className="mt-6 text-center">
        <Link to="/portal" className="text-[11px] text-text-3 hover:text-danger">
          ← Back to portal home
        </Link>
      </div>
    </div>
  );
}