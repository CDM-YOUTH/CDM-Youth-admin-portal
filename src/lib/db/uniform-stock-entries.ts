import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type ProductionActivity = "sewing" | "logo" | "branding";

export type StockEntry = {
  id: string;
  sku_id: string | null;
  item_name: string;
  quantity: number;
  notes: string | null;
  activity: ProductionActivity;
  entered_at: string;
  created_at: string;
};

export type StockEntryInput = {
  itemName: string;
  quantity: number;
  activity?: ProductionActivity;
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
  const activity = input.activity ?? "sewing";
  let skuId: string | null = null;
  if (input.itemName) {
    const { data: sku } = await db
      .from("uniform_skus")
      .select("id, in_stock")
      .eq("name", input.itemName)
      .maybeSingle();
    if (sku) {
      skuId = (sku as { id: string; in_stock: number }).id;
      // Only a sewing entry represents newly produced stock — logo/branding
      // are finishing steps applied to units already counted, so they must
      // not add to in_stock again (that would double-count the same units).
      if (activity === "sewing") {
        await db
          .from("uniform_skus")
          .update({ in_stock: (sku as { id: string; in_stock: number }).in_stock + input.quantity })
          .eq("id", skuId);
      }
    }
  }

  const { data, error } = await db
    .from("uniform_stock_entries")
    .insert({
      sku_id:     skuId,
      item_name:  input.itemName,
      quantity:   input.quantity,
      activity,
      notes:      input.notes     ?? null,
      entered_at: input.enteredAt ?? new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data as StockEntry;
}

export async function deleteStockEntry(id: string): Promise<void> {
  // Reverse the stock bump a sewing entry applied — otherwise in_stock keeps
  // counting units whose log entry no longer exists.
  const { data: entry } = await db
    .from("uniform_stock_entries")
    .select("sku_id, quantity, activity")
    .eq("id", id)
    .maybeSingle();

  if (entry?.sku_id && entry.activity === "sewing") {
    const { data: sku } = await db.from("uniform_skus").select("in_stock").eq("id", entry.sku_id).maybeSingle();
    if (sku) {
      const nextStock = Math.max(0, Number(sku.in_stock) - Number(entry.quantity));
      await db.from("uniform_skus").update({ in_stock: nextStock }).eq("id", entry.sku_id);
    }
  }

  const { error } = await db.from("uniform_stock_entries").delete().eq("id", id);
  if (error) throw error;
}
