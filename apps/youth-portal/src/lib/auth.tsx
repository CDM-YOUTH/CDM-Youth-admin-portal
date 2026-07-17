import * as React from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type YouthRow = Tables<"youths">;
type AuthStatus = "loading" | "authed" | "guest";

type AuthContextValue = {
  status: AuthStatus;
  session: Session | null;
  youth: YouthRow | null;
  refreshYouth: () => Promise<void>;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null);
  const [youth, setYouth] = React.useState<YouthRow | null>(null);
  const [status, setStatus] = React.useState<AuthStatus>("loading");

  const loadYouth = React.useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase.from("youths").select("*").eq("auth_user_id", userId).maybeSingle();
      if (error) throw error;
      setYouth(data ?? null);
    } catch (err) {
      // A failed profile lookup must never wedge the auth status in "loading"
      // forever — the session itself is still valid.
      console.error("Failed to load youth profile:", err);
      setYouth(null);
    }
  }, []);

  const refreshYouth = React.useCallback(async () => {
    if (session?.user.id) await loadYouth(session.user.id);
  }, [session, loadYouth]);

  React.useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user.id) await loadYouth(data.session.user.id);
      setStatus(data.session ? "authed" : "guest");
    });

    // IMPORTANT: this callback must stay synchronous. supabase-js holds an
    // internal auth lock while notifying listeners — awaiting another
    // Supabase call (loadYouth) directly inside this callback deadlocks
    // signInWithPassword's own promise forever. Defer the async work instead.
    // https://github.com/supabase/supabase-js — documented onAuthStateChange gotcha.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user.id) {
        setTimeout(() => {
          loadYouth(nextSession.user.id).finally(() => setStatus("authed"));
        }, 0);
      } else {
        setYouth(null);
        setStatus("guest");
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadYouth]);

  return (
    <AuthContext.Provider value={{ status, session, youth, refreshYouth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
