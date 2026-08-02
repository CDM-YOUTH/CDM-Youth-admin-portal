import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type PaymentStatus = "unpaid" | "partial" | "paid";
export type OrderStage = "placed" | "confirmed" | "dispatched" | "delivered" | "cancelled";

export type UniformSale = {
  id: string;
  sku_id: string | null;
  item_name: string;
  youth_name: string;
  youth_id: string | null;
  size: string | null;
  parish_name: string | null;
  quantity: number;
  unit_price: number;
  ordered_at: string;
  delivered_at: string | null;
  paid_at: string | null;
  paid_amount: number;
  payment_status: PaymentStatus;
  notes: string | null;
  order_ref: string;
  stage: OrderStage;
  delivery_location: string | null;
  confirmed_at: string | null;
  confirmed_by: string | null;
  dispatch_contact_name: string | null;
  dispatch_contact_phone: string | null;
  dispatch_method: string | null;
  dispatch_scheduled_at: string | null;
  dispatched_at: string | null;
  delivered_by: string | null;
  created_at: string;
  updated_at: string;
};

export type UniformSaleInput = {
  itemName: string;
  youthName: string;
  parishName?: string | null;
  size?: string | null;
  deliveryLocation?: string | null;
  quantity: number;
  unitPrice: number;
  orderedAt?: string | null;
  notes?: string | null;
};

export type UniformSaleUpdateInput = {
  itemName?: string;
  youthName?: string;
  parishName?: string | null;
  size?: string | null;
  deliveryLocation?: string | null;
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

export async function listUniformSalesPaged(opts: {
  page?: number;
  size?: number;
  q?: string;
  stage?: string | null;
  paymentStatus?: string | null;
  from?: string | null;
  to?: string | null;
}): Promise<{ data: UniformSale[]; total: number; page: number; size: number }> {
  const page = opts.page ?? 0;
  const size = Math.min(opts.size ?? 25, 100);

  let query = db
    .from("uniform_sales")
    .select("*", { count: "exact" })
    .order("ordered_at", { ascending: false })
    .range(page * size, page * size + size - 1);

  if (opts.stage) {
    if (opts.stage === "pending") {
      query = query.not("stage", "in", "(delivered,cancelled)");
    } else {
      query = query.eq("stage", opts.stage);
    }
  }
  if (opts.paymentStatus === "not_paid") {
    query = query.neq("payment_status", "paid");
  } else if (opts.paymentStatus) {
    query = query.eq("payment_status", opts.paymentStatus);
  }
  if (opts.from) query = query.gte("ordered_at", opts.from);
  if (opts.to)   query = query.lte("ordered_at", `${opts.to}T23:59:59Z`);
  if (opts.q?.trim()) {
    const t = `%${opts.q.trim()}%`;
    query = query.or(`youth_name.ilike.${t},item_name.ilike.${t},parish_name.ilike.${t}`);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: (data ?? []) as UniformSale[], total: count ?? 0, page, size };
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
      sku_id:            skuId,
      item_name:         input.itemName,
      youth_name:        input.youthName,
      parish_name:       input.parishName ?? null,
      size:              input.size ?? null,
      delivery_location: input.deliveryLocation ?? null,
      quantity:          input.quantity,
      unit_price:        input.unitPrice,
      ordered_at:        input.orderedAt ?? new Date().toISOString(),
      notes:             input.notes ?? null,
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
  if (input.size        !== undefined) payload.size         = input.size;
  if (input.deliveryLocation !== undefined) payload.delivery_location = input.deliveryLocation;
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

/** Stage 1: staff acknowledges/accepts a placed order. */
export async function confirmOrder(id: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await db
    .from("uniform_sales")
    .update({ stage: "confirmed", confirmed_at: new Date().toISOString(), confirmed_by: auth.user?.id ?? null })
    .eq("id", id);
  if (error) throw error;
}

/** Stage 2: dispatch details — who's delivering, how, and when. */
export async function confirmDispatch(
  id: string,
  input: { contactName: string; contactPhone?: string | null; method: string; scheduledAt?: string | null },
): Promise<void> {
  const { error } = await db
    .from("uniform_sales")
    .update({
      stage: "dispatched",
      dispatch_contact_name: input.contactName,
      dispatch_contact_phone: input.contactPhone ?? null,
      dispatch_method: input.method,
      dispatch_scheduled_at: input.scheduledAt ?? null,
      dispatched_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

/** Stage 3: confirm the item actually reached the youth. */
export async function confirmDelivery(id: string, deliveredBy?: string | null): Promise<void> {
  const { error } = await db
    .from("uniform_sales")
    .update({
      stage: "delivered",
      delivered_at: new Date().toISOString(),
      delivered_by: deliveredBy ?? null,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function cancelOrder(id: string): Promise<void> {
  const { error } = await db.from("uniform_sales").update({ stage: "cancelled" }).eq("id", id);
  if (error) throw error;
}

/** @deprecated use confirmDelivery — kept for any existing callers */
export async function markDelivered(id: string): Promise<void> {
  return confirmDelivery(id);
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
