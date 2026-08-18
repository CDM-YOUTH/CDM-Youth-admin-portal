import { createContext, useContext } from "react";
import { supabase } from "@/integrations/supabase/client";

export type UserScope = {
  deaneryId: string | null;
  parishId: string | null;
  outstationId: string | null;
  role: string | null;
};

export const emptyScope: UserScope = {
  deaneryId: null,
  parishId: null,
  outstationId: null,
  role: null,
};

export const AdminScopeCtx = createContext<UserScope>(emptyScope);

/** Read the current user's org scope. Use inside any /admin/* component. */
export function useAdminScope(): UserScope {
  return useContext(AdminScopeCtx);
}

/** Fetch the logged-in user's scope from their profile. Called once by the admin layout. */
export async function fetchMyScope(): Promise<UserScope> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return emptyScope;

  // Two flat queries, not a nested `user_roles(role)` embed — there's no direct FK
  // between profiles and user_roles (both independently reference auth.users(id)),
  // so PostgREST can't resolve that embed and it silently returns null.
  const [{ data: profile }, { data: roleRow }] = await Promise.all([
    supabase
      .from("profiles")
      .select("deanery_id, parish_id, outstation_id")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
  ]);

  return {
    deaneryId: profile?.deanery_id ?? null,
    parishId: profile?.parish_id ?? null,
    outstationId: profile?.outstation_id ?? null,
    role: roleRow?.role ?? null,
  };
}
