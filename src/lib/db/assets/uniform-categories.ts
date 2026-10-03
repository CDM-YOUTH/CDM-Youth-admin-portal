import { supabase } from "@/integrations/supabase/client";

export type UniformCategory = {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export async function listUniformCategories(includeInactive = false): Promise<UniformCategory[]> {
  let query = supabase.from("uniform_categories").select("*").order("sort_order");

  if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as UniformCategory[];
}

export async function createUniformCategory(input: {
  name: string;
  description?: string;
  sortOrder?: number;
}): Promise<UniformCategory> {
  const { data, error } = await supabase
    .from("uniform_categories")
    .insert({
      name: input.name,
      description: input.description ?? null,
      sort_order: input.sortOrder ?? 0,
    })
    .select()
    .single();
  if (error) throw error;
  return data as UniformCategory;
}

export async function updateUniformCategory(
  id: string,
  input: {
    name?: string;
    description?: string;
    isActive?: boolean;
    sortOrder?: number;
  },
): Promise<UniformCategory> {
  const payload: Record<string, unknown> = {};
  if (input.name !== undefined) payload.name = input.name;
  if (input.description !== undefined) payload.description = input.description;
  if (input.isActive !== undefined) payload.is_active = input.isActive;
  if (input.sortOrder !== undefined) payload.sort_order = input.sortOrder;

  const { data, error } = await supabase
    .from("uniform_categories")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as UniformCategory;
}
