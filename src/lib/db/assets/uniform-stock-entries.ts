import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type UniformActivity = {
  id: string;
  name: string;
  description: string | null;
  activity_type: "in" | "out";
  created_at: string;
};

export type StockEntry = {
  id: string;
  item_id: string | null;
  item_name: string;
  activity_id: string | null;
  activity_name: string;
  quantity: number;
  description: string | null;
  created_at: string;
};

export type StockEntryInput = {
  itemName: string;
  activityName: string;
  quantity: number;
  description?: string | null;
};

export async function listUniformActivities(): Promise<UniformActivity[]> {
  const { data, error } = await db.from("uniform_activities").select("*").order("name");
  if (error) throw error;
  return (data ?? []) as UniformActivity[];
}

export async function listStockEntries(limit = 300): Promise<StockEntry[]> {
  const { data, error } = await db
    .from("uniform_stock_entries")
    .select(
      `
      id,
      item_id,
      quantity,
      description,
      created_at,
      item:uniform_items(name),
      activity:uniform_activities(name)
    `,
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((e: any) => ({
    id: e.id,
    item_id: e.item_id,
    item_name: e.item?.name ?? "Unknown",
    activity_id: null,
    activity_name: e.activity?.name ?? "Unknown",
    quantity: e.quantity,
    description: e.description,
    created_at: e.created_at,
  }));
}

export async function createStockEntry(input: StockEntryInput): Promise<StockEntry> {
  let itemId: string | null = null;
  if (input.itemName) {
    const { data: item } = await db
      .from("uniform_items")
      .select("id")
      .eq("name", input.itemName)
      .maybeSingle();
    itemId = (item as { id: string } | null)?.id ?? null;
  }

  let activityId: string | null = null;
  if (input.activityName) {
    const { data: activity } = await db
      .from("uniform_activities")
      .select("id")
      .eq("name", input.activityName)
      .maybeSingle();
    activityId = (activity as { id: string } | null)?.id ?? null;
  }

  const { data, error } = await db
    .from("uniform_stock_entries")
    .insert({
      item_id: itemId,
      activity_id: activityId,
      quantity: input.quantity,
      description: input.description ?? null,
    })
    .select(
      `
      id,
      item_id,
      quantity,
      description,
      created_at,
      item:uniform_items(name),
      activity:uniform_activities(name)
    `,
    )
    .single();
  if (error) throw error;
  const entry = data as any;
  return {
    id: entry.id,
    item_id: entry.item_id,
    item_name: entry.item?.name ?? input.itemName,
    activity_id: activityId,
    activity_name: entry.activity?.name ?? input.activityName,
    quantity: entry.quantity,
    description: entry.description,
    created_at: entry.created_at,
  };
}

export async function deleteStockEntry(id: string): Promise<void> {
  const { error } = await db.from("uniform_stock_entries").delete().eq("id", id);
  if (error) throw error;
}
