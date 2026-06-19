import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type StockEntry = {
  id: string;
  sku_id: string | null;
  item_name: string;
  quantity: number;
  notes: string | null;
  entered_at: string;
  created_at: string;
};

export type StockEntryInput = {
  itemName: string;
  quantity: number;
  notes?: string | null;
  enteredAt?: string | null;
};

export async function listStockEntries(limit = 300): Promise<StockEntry[]> {
  const { data, error } = await db
    .from("uniform_stock_entries")
    .select("*")
    .order("entered_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as StockEntry[];
}

export async function createStockEntry(input: StockEntryInput): Promise<StockEntry> {
  let skuId: string | null = null;
  if (input.itemName) {
    const { data: sku } = await db
      .from("uniform_skus")
      .select("id, in_stock")
      .eq("name", input.itemName)
      .maybeSingle();
    if (sku) {
      skuId = (sku as { id: string; in_stock: number }).id;
      await db
        .from("uniform_skus")
        .update({ in_stock: (sku as { id: string; in_stock: number }).in_stock + input.quantity })
        .eq("id", skuId);
    }
  }

  const { data, error } = await db
    .from("uniform_stock_entries")
    .insert({
      sku_id:     skuId,
      item_name:  input.itemName,
      quantity:   input.quantity,
      notes:      input.notes     ?? null,
      entered_at: input.enteredAt ?? new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data as StockEntry;
}

export async function deleteStockEntry(id: string): Promise<void> {
  const { error } = await db.from("uniform_stock_entries").delete().eq("id", id);
  if (error) throw error;
}
