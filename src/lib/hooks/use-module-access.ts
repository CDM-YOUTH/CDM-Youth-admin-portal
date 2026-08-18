import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminScope } from "@/lib/hooks/use-admin-scope";

export type ModulePermission = {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

export type ModuleAccess = Record<string, ModulePermission>;

/** Every /admin/* route mapped to its role_permissions module key. */
export const MODULE_BY_PATH: Record<string, string> = {
  "/admin/dashboard": "dashboard",
  "/admin/youths": "youths",
  "/admin/enrollment": "enrollment",
  "/admin/leaders": "leaders",
  "/admin/cusa": "cusa",
  "/admin/events": "events",
  "/admin/mission": "mission",
  "/admin/formation": "formation",
  "/admin/welfare": "welfare",
  "/admin/uniforms": "uniforms",
  "/admin/reports": "reports",
  "/admin/users": "users",
  "/admin/settings": "settings",
};

export async function fetchModuleAccess(role: string | null): Promise<ModuleAccess> {
  // role_permissions isn't modeled in the generated Database types (see types.ts header) —
  // cast is required here, matching the existing pattern in admin.users.tsx's RolesTab.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("role_permissions")
    .select("module, can_view, can_create, can_edit, can_delete")
    .eq("role", role ?? "user");
  if (error) throw error;

  const access: ModuleAccess = {};
  for (const row of (data ?? []) as {
    module: string;
    can_view: boolean;
    can_create: boolean;
    can_edit: boolean;
    can_delete: boolean;
  }[]) {
    access[row.module] = {
      canView: row.can_view,
      canCreate: row.can_create,
      canEdit: row.can_edit,
      canDelete: row.can_delete,
    };
  }
  return access;
}

/** The current user's per-module view/create/edit/delete permissions, from role_permissions. */
export function useModuleAccess() {
  const scope = useAdminScope();
  return useQuery({
    queryKey: ["module-access", scope.role],
    queryFn: () => fetchModuleAccess(scope.role),
    staleTime: 5 * 60_000,
  });
}
