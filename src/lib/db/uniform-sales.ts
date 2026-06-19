import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type PaymentStatus = "unpaid" | "partial" | "paid";

export type UniformSale = {
  id: string;
  sku_id: string | null;
  item_name: string;
  youth_name: string;
  parish_name: string | null;
  quantity: number;
  unit_price: number;
  ordered_at: string;
  delivered_at: string | null;
  paid_at: string | null;
  paid_amount: number;
  payment_status: PaymentStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type UniformSaleInput = {
  itemName: string;
  youthName: string;
  parishName?: string | null;
  quantity: number;
  unitPrice: number;
  orderedAt?: string | null;
  notes?: string | null;
};

export type UniformSaleUpdateInput = {
  itemName?: string;
  youthName?: string;
  parishName?: string | null;
  quantity?: number;
  unitPrice?: number;
  orderedAt?: string | null;
  deliveredAt?: string | null;
  notes?: string | null;
};

export async function listUniformSales(limit = 300): Promise<UniformSale[]> {
  const { data, error } = await db
    .from("uniform_sales")
    .select("*")
    .order("ordered_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as UniformSale[];
}

export async function createUniformSale(input: UniformSaleInput): Promise<UniformSale> {
  let skuId: string | null = null;
  if (input.itemName) {
    const { data: sku } = await db
      .from("uniform_skus")
      .select("id")
      .eq("name", input.itemName)
      .maybeSingle();
    skuId = (sku as { id: string } | null)?.id ?? null;
  }

  const { data, error } = await db
    .from("uniform_sales")
    .insert({
      sku_id:      skuId,
      item_name:   input.itemName,
      youth_name:  input.youthName,
      parish_name: input.parishName  ?? null,
      quantity:    input.quantity,
      unit_price:  input.unitPrice,
      ordered_at:  input.orderedAt   ?? new Date().toISOString(),
      notes:       input.notes       ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as UniformSale;
}

export async function updateUniformSale(id: string, input: UniformSaleUpdateInput): Promise<UniformSale> {
  const payload: Record<string, unknown> = {};
  if (input.itemName    !== undefined) payload.item_name    = input.itemName;
  if (input.youthName   !== undefined) payload.youth_name   = input.youthName;
  if (input.parishName  !== undefined) payload.parish_name  = input.parishName;
  if (input.quantity    !== undefined) payload.quantity     = input.quantity;
  if (input.unitPrice   !== undefined) payload.unit_price   = input.unitPrice;
  if (input.orderedAt   !== undefined) payload.ordered_at   = input.orderedAt   || null;
  if (input.deliveredAt !== undefined) payload.delivered_at = input.deliveredAt || null;
  if (input.notes       !== undefined) payload.notes        = input.notes;

  const { data, error } = await db
    .from("uniform_sales")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as UniformSale;
}

export async function markDelivered(id: string): Promise<void> {
  const { error } = await db
    .from("uniform_sales")
    .update({ delivered_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function recordPayment(id: string, totalPaidSoFar: number): Promise<void> {
  const { data: sale, error: fetchErr } = await db
    .from("uniform_sales")
    .select("quantity, unit_price")
    .eq("id", id)
    .single();
  if (fetchErr) throw fetchErr;

  const total = Number(sale.quantity) * Number(sale.unit_price);
  const clamped = Math.min(totalPaidSoFar, total);
  const status: PaymentStatus =
    clamped >= total ? "paid" : clamped > 0 ? "partial" : "unpaid";

  const { error } = await db
    .from("uniform_sales")
    .update({
      paid_amount:    clamped,
      paid_at:        status === "paid" ? new Date().toISOString() : null,
      payment_status: status,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteUniformSale(id: string): Promise<void> {
  const { error } = await db.from("uniform_sales").delete().eq("id", id);
  if (error) throw error;
}
