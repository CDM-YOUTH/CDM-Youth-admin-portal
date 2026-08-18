import { supabase } from "@/integrations/supabase/client";

export type RoleRow = {
  name: string;
  label: string;
  description: string | null;
  color: string | null;
  is_system: boolean;
  created_at: string;
};

export async function fetchRoles(): Promise<RoleRow[]> {
  const { data, error } = await supabase.from("roles").select("*").order("created_at");
  if (error) throw error;
  return data ?? [];
}

export async function createRole(input: {
  name: string;
  label: string;
  description?: string | null;
  color?: string | null;
}): Promise<RoleRow> {
  const { data, error } = await supabase
    .from("roles")
    .insert({
      name: input.name,
      label: input.label,
      description: input.description ?? null,
      color: input.color ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteRole(name: string): Promise<void> {
  const { error } = await supabase.from("roles").delete().eq("name", name);
  if (error) throw error;
}
