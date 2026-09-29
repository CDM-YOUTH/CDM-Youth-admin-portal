import { supabase } from "@/integrations/supabase/client";
import { likePattern } from "@/lib/utils";

export type UniformItemCategory = "youth" | "sewing" | "organization" | "other";

export type UniformItem = {
  id: string;
  name: string;
  swatch: string | null;
  unit_price: number | null;
  category?: UniformItemCategory;
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
  category?: UniformItemCategory;
};

export type UniformItemUpdateInput = {
  name?: string;
  swatch?: string | null;
  unitPrice?: number | null;
  category?: UniformItemCategory;
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
    .select("*")
    .order("name");
  if (error) throw error;
  return (data ?? []) as UniformItemWithStock[];
}

export async function createUniformItem(input: UniformItemInput): Promise<UniformItem> {
  const { data, error } = await db
    .from("uniform_items")
    .insert({
      name: input.name,
      swatch: input.swatch ?? null,
      unit_price: input.unitPrice ?? null,
      category: input.category ?? "youth",
    })
    .select()
    .single();
  if (error) throw error;
  return data as UniformItem;
}

export async function updateUniformItem(id: string, input: UniformItemUpdateInput): Promise<UniformItem> {
  const payload: Record<string, unknown> = {};
  if (input.name !== undefined) payload.name = input.name;
  if (input.swatch !== undefined) payload.swatch = input.swatch;
  if (input.unitPrice !== undefined) payload.unit_price = input.unitPrice;
  if (input.category !== undefined) payload.category = input.category;

  const { data, error } = await db
    .from("uniform_items")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as UniformItem;
}

export async function deleteUniformItem(id: string): Promise<void> {
  const { error } = await db.from("uniform_items").delete().eq("id", id);
  if (error) throw error;
}
