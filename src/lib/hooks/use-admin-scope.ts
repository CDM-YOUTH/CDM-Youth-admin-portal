import { createContext, useContext } from "react";
import { supabase } from "@/integrations/supabase/client";

export type UserScope = {
  deaneryId: string | null;
  parishId: string | null;
  role: string | null;
};

export const emptyScope: UserScope = { deaneryId: null, parishId: null, role: null };

export const AdminScopeCtx = createContext<UserScope>(emptyScope);

/** Read the current user's org scope. Use inside any /admin/* component. */
export function useAdminScope(): UserScope {
  return useContext(AdminScopeCtx);
}

/** Fetch the logged-in user's scope from their profile. Called once by the admin layout. */
export async function fetchMyScope(): Promise<UserScope> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return emptyScope;

  const { data } = await (supabase as any)
    .from("profiles")
    .select("deanery_id, parish_id, user_roles(role)")
    .eq("id", user.id)
    .maybeSingle();

  return {
    deaneryId: data?.deanery_id ?? null,
    parishId:  data?.parish_id  ?? null,
    role:      (data?.user_roles as { role: string }[] | null)?.[0]?.role ?? null,
  };
}
