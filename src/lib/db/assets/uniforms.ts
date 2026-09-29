import { supabase } from "@/integrations/supabase/client";
import { likePattern } from "@/lib/utils";

export type UniformItem = {
  id: string;
  name: string;
  swatch: string | null;
  unit_price: number | null;
  category_id?: string | null;
  category_name?: string;
  created_at: string;
  updated_at: string;
};

export type UniformItemWithStock = UniformItem & {
  stock_in: number;
  stock_out_delivered: number;
  pending_youth_orders: number;
  available_stock: number;
};

export type UniformItemInput = {
  name: string;
  swatch?: string | null;
  unitPrice?: number | null;
  categoryId?: string | null;
};

export type UniformItemUpdateInput = {
  name?: string;
  swatch?: string | null;
  unitPrice?: number | null;
  categoryId?: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export async function listUniformItems(): Promise<UniformItem[]> {
  const { data, error } = await db.from("uniform_items").select("*").order("name");
  if (error) throw error;
  return (data ?? []) as UniformItem[];
}

export async function listUniformItemsWithStock(): Promise<UniformItemWithStock[]> {
  const { data, error } = await db
    .from("uniform_items_with_stock")
    .select("*, category:uniform_categories(name)")
    .order("name");
  if (error) throw error;
  return ((data ?? []) as any[]).map((item) => ({
    ...item,
    category_name: item.category?.name,
  })) as UniformItemWithStock[];
}

export async function createUniformItem(input: UniformItemInput): Promise<UniformItem> {
  const { data, error } = await db
    .from("uniform_items")
    .insert({
      name: input.name,
      swatch: input.swatch ?? null,
      unit_price: input.unitPrice ?? null,
      category_id: input.categoryId ?? null,
    })
    .select(`*, category:uniform_categories(name)`)
    .single();
  if (error) throw error;
  const item = data as any;
  return {
    ...item,
    category_name: item.category?.name,
  };
}

export async function updateUniformItem(id: string, input: UniformItemUpdateInput): Promise<UniformItem> {
  const payload: Record<string, unknown> = {};
  if (input.name !== undefined) payload.name = input.name;
  if (input.swatch !== undefined) payload.swatch = input.swatch;
  if (input.unitPrice !== undefined) payload.unit_price = input.unitPrice;
  if (input.categoryId !== undefined) payload.category_id = input.categoryId;

  const { data, error } = await db
    .from("uniform_items")
    .update(payload)
    .eq("id", id)
    .select(`*, category:uniform_categories(name)`)
    .single();
  if (error) throw error;
  const item = data as any;
  return {
    ...item,
    category_name: item.category?.name,
  };
}

export async function deleteUniformItem(id: string): Promise<void> {
  const { error } = await db.from("uniform_items").delete().eq("id", id);
  if (error) throw error;
}
