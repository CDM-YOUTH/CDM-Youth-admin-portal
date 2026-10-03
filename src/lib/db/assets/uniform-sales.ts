import { supabase } from "@/integrations/supabase/client";
import { likePattern } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type PaymentStatus = "pending" | "paid" | "waived";
export type OrderStatus =
  "pending" | "approved" | "paid" | "dispatched" | "delivered" | "cancelled";

export type OrderType = "youth" | "patronage" | "walk_in";

export type UniformOrder = {
  id: string;
  order_number: string;
  item_id: string | null;
  item_name: string;
  quantity: number;
  ordered_by: string | null;
  youth_id: string | null;
  cdm_id: string | null;
  ordered_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_notes: string | null;
  payment_status: PaymentStatus;
  paid_at: string | null;
  paid_by: string | null;
  payment_method: string | null;
  dispatch_contact_name: string | null;
  dispatch_contact_phone: string | null;
  dispatch_method: string | null;
  dispatch_scheduled_at: string | null;
  dispatched_at: string | null;
  dispatch_by: string | null;
  dispatch_notes: string | null;
  delivered_at: string | null;
  delivered_by: string | null;
  delivery_notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
  // Walk-in order fields
  ordered_by_name?: string | null;
  ordered_by_phone?: string | null;
  ordered_for_name?: string | null;
  deanery_id?: string | null;
  order_type?: OrderType;
  // Computed status from view
  status: OrderStatus;
  // Joined fields for display
  youth_name?: string;
  parish_name?: string;
  unit_price?: number;
};

export type UniformOrderInput = {
  itemName: string;
  quantity: number;
  youthId?: string | null;
  cdmId?: string | null;
  notes?: string | null;
  // Walk-in order fields (when order_type is 'walk_in')
  orderType?: OrderType;
  orderedForName?: string | null;
  orderedByName?: string | null;
  orderedByPhone?: string | null;
  deaneryId?: string | null;
};

export type UniformOrderUpdateInput = {
  itemName?: string;
  quantity?: number;
  reviewNotes?: string | null;
  paymentStatus?: PaymentStatus;
  paymentMethod?: string | null;
  dispatchContactName?: string | null;
  dispatchContactPhone?: string | null;
  dispatchMethod?: string | null;
  dispatchScheduledAt?: string | null;
  dispatchNotes?: string | null;
  deliveredBy?: string | null;
  deliveryNotes?: string | null;
};

export async function listUniformOrders(limit = 300): Promise<UniformOrder[]> {
  const { data, error } = await db
    .from("uniform_orders_with_status")
    .select(
      `
      *,
      item:uniform_items(name, unit_price),
      youth:youths(id, first_name, last_name, parish_id),
      parish:parishes(name)
    `,
    )
    .order("ordered_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((o: any) => ({
    ...o,
    item_name: o.item?.name ?? "Unknown",
    unit_price: o.item?.unit_price ?? 0,
    youth_name: o.youth ? `${o.youth.first_name} ${o.youth.last_name}` : null,
    parish_name: o.parish?.name ?? null,
  }));
}

export async function listUniformOrdersPaged(opts: {
  page?: number;
  size?: number;
  q?: string;
  status?: string | null;
  paymentStatus?: string | null;
  from?: string | null;
  to?: string | null;
}): Promise<{ data: UniformOrder[]; total: number; page: number; size: number }> {
  const page = opts.page ?? 0;
  const size = Math.min(opts.size ?? 25, 100);

  let query = db
    .from("uniform_orders_with_status")
    .select(
      `
      *,
      item:uniform_items(name, unit_price),
      youth:youths(id, first_name, last_name, parish_id),
      parish:parishes(name)
    `,
      { count: "exact" },
    )
    .order("ordered_at", { ascending: false })
    .range(page * size, page * size + size - 1);

  if (opts.status) {
    query = query.eq("status", opts.status);
  }
  if (opts.paymentStatus) {
    query = query.eq("payment_status", opts.paymentStatus);
  }
  if (opts.from) query = query.gte("ordered_at", opts.from);
  if (opts.to) query = query.lte("ordered_at", `${opts.to}T23:59:59Z`);
  if (opts.q?.trim()) {
    const t = likePattern(opts.q);
    query = query.or(`cdm_id.ilike.${t},item.name.ilike.${t},parish.name.ilike.${t}`);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  const mappedData = (data ?? []).map((o: any) => ({
    ...o,
    item_name: o.item?.name ?? "Unknown",
    unit_price: o.item?.unit_price ?? 0,
    youth_name: o.youth ? `${o.youth.first_name} ${o.youth.last_name}` : null,
    parish_name: o.parish?.name ?? null,
  }));
  return { data: mappedData as UniformOrder[], total: count ?? 0, page, size };
}

export async function createUniformOrder(input: UniformOrderInput): Promise<UniformOrder> {
  let itemId: string | null = null;
  if (input.itemName) {
    const { data: item } = await db
      .from("uniform_items")
      .select("id")
      .eq("name", input.itemName)
      .maybeSingle();
    itemId = (item as { id: string } | null)?.id ?? null;
  }

  // Determine order type
  const orderType: OrderType =
    input.orderType ?? (input.youthId || input.cdmId ? "youth" : "walk_in");

  const { data, error } = await db
    .from("uniform_orders")
    .insert({
      item_id: itemId,
      quantity: input.quantity,
      youth_id: input.youthId ?? null,
      cdm_id: input.cdmId ?? null,
      review_notes: input.notes ?? null,
      order_type: orderType,
      ordered_for_name: input.orderedForName ?? null,
      ordered_by_name: input.orderedByName ?? null,
      ordered_by_phone: input.orderedByPhone ?? null,
      deanery_id: input.deaneryId ?? null,
    })
    .select(
      `
      *,
      item:uniform_items(name, unit_price),
      youth:youths(id, first_name, last_name, parish_id),
      parish:parishes(name)
    `,
    )
    .single();
  if (error) throw error;
  const order = data as any;
  return {
    ...order,
    item_name: order.item?.name ?? input.itemName,
    unit_price: order.item?.unit_price ?? 0,
    youth_name: order.youth ? `${order.youth.first_name} ${order.youth.last_name}` : null,
    parish_name: order.parish?.name ?? null,
    status: "pending",
  };
}

export async function updateUniformOrder(
  id: string,
  input: UniformOrderUpdateInput,
): Promise<UniformOrder> {
  const payload: Record<string, unknown> = {};
  if (input.reviewNotes !== undefined) payload.review_notes = input.reviewNotes;
  if (input.paymentStatus !== undefined) payload.payment_status = input.paymentStatus;
  if (input.paymentMethod !== undefined) payload.payment_method = input.paymentMethod;
  if (input.dispatchContactName !== undefined)
    payload.dispatch_contact_name = input.dispatchContactName;
  if (input.dispatchContactPhone !== undefined)
    payload.dispatch_contact_phone = input.dispatchContactPhone;
  if (input.dispatchMethod !== undefined) payload.dispatch_method = input.dispatchMethod;
  if (input.dispatchScheduledAt !== undefined)
    payload.dispatch_scheduled_at = input.dispatchScheduledAt;
  if (input.dispatchNotes !== undefined) payload.dispatch_notes = input.dispatchNotes;
  if (input.deliveredBy !== undefined) payload.delivered_by = input.deliveredBy;
  if (input.deliveryNotes !== undefined) payload.delivery_notes = input.deliveryNotes;

  const { data, error } = await db
    .from("uniform_orders")
    .update(payload)
    .eq("id", id)
    .select(
      `
      *,
      item:uniform_items(name, unit_price),
      youth:youths(id, first_name, last_name, parish_id),
      parish:parishes(name)
    `,
    )
    .single();
  if (error) throw error;
  const order = data as any;
  return {
    ...order,
    item_name: order.item?.name ?? "Unknown",
    unit_price: order.item?.unit_price ?? 0,
    youth_name: order.youth ? `${order.youth.first_name} ${order.youth.last_name}` : null,
    parish_name: order.parish?.name ?? null,
  };
}

/** Stage 1: staff acknowledges/accepts a placed order. */
export async function approveOrder(id: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await db
    .from("uniform_orders")
    .update({ reviewed_at: new Date().toISOString(), reviewed_by: auth.user?.id ?? null })
    .eq("id", id);
  if (error) throw error;
}

/** Stage 2: record payment. */
export async function recordPayment(id: string, paymentMethod?: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await db
    .from("uniform_orders")
    .update({
      payment_status: "paid",
      paid_at: new Date().toISOString(),
      paid_by: auth.user?.id ?? null,
      payment_method: paymentMethod ?? null,
    })
    .eq("id", id);
  if (error) throw error;
}

/** Stage 3: dispatch details — who's delivering, how, and when. */
export async function confirmDispatch(
  id: string,
  input: {
    contactName: string;
    contactPhone?: string | null;
    method: string;
    scheduledAt?: string | null;
    notes?: string | null;
  },
): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await db
    .from("uniform_orders")
    .update({
      dispatch_contact_name: input.contactName,
      dispatch_contact_phone: input.contactPhone ?? null,
      dispatch_method: input.method,
      dispatch_scheduled_at: input.scheduledAt ?? null,
      dispatch_notes: input.notes ?? null,
      dispatched_at: new Date().toISOString(),
      dispatch_by: auth.user?.id ?? null,
    })
    .eq("id", id);
  if (error) throw error;
}

/** Stage 4: confirm the item actually reached the youth. */
export async function confirmDelivery(
  id: string,
  deliveredBy?: string | null,
  notes?: string | null,
): Promise<void> {
  const { error } = await db
    .from("uniform_orders")
    .update({
      delivered_at: new Date().toISOString(),
      delivered_by: deliveredBy ?? null,
      delivery_notes: notes ?? null,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function cancelOrder(id: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await db
    .from("uniform_orders")
    .update({ deleted_at: new Date().toISOString(), deleted_by: auth.user?.id ?? null })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteUniformOrder(id: string): Promise<void> {
  const { error } = await db.from("uniform_orders").delete().eq("id", id);
  if (error) throw error;
}

/* ── Search & Lookup Functions ── */

export type OrderRecipient = {
  id: string;
  type: "youth" | "patronage";
  name: string;
  cdmId?: string;
  parishName?: string;
  parishId?: string;
  deaneryName?: string;
};

export async function searchOrderRecipients(opts: {
  q?: string;
  deaneryId?: string;
  parishId?: string;
  limit?: number;
}): Promise<OrderRecipient[]> {
  const { q = "", deaneryId, parishId, limit = 25 } = opts;

  if (!q || q.length < 2) return [];

  const pattern = likePattern(q);
  let youthQuery = db
    .from("youths")
    .select(
      `
      id, cdm_id, first_name, last_name, parish_id,
      parish:parishes(id, name, deanery_id, deanery:deaneries(name))
    `,
    )
    .ilike("first_name", pattern);

  if (deaneryId) {
    youthQuery = youthQuery.eq("parish.deanery_id", deaneryId);
  }
  if (parishId) {
    youthQuery = youthQuery.eq("parish_id", parishId);
  }

  youthQuery = youthQuery.limit(limit / 2);

  const { data: youths, error: youthError } = await youthQuery;

  let patronageQuery = db
    .from("patronage_team")
    .select(
      `
      id, first_name, last_name, parish_id,
      parish:parishes(id, name, deanery_id, deanery:deaneries(name))
    `,
    )
    .ilike("first_name", pattern);

  if (deaneryId) {
    patronageQuery = patronageQuery.eq("parish.deanery_id", deaneryId);
  }
  if (parishId) {
    patronageQuery = patronageQuery.eq("parish_id", parishId);
  }

  patronageQuery = patronageQuery.limit(limit / 2);

  const { data: patronage, error: patronageError } = await patronageQuery;

  const results: OrderRecipient[] = [];

  if (!youthError && youths) {
    youths.forEach((y: any) => {
      results.push({
        id: y.id,
        type: "youth",
        name: `${y.first_name} ${y.last_name}`,
        cdmId: y.cdm_id,
        parishId: y.parish_id,
        parishName: y.parish?.name,
        deaneryName: y.parish?.deanery?.name,
      });
    });
  }

  if (!patronageError && patronage) {
    patronage.forEach((p: any) => {
      results.push({
        id: p.id,
        type: "patronage",
        name: `${p.first_name} ${p.last_name}`,
        parishId: p.parish_id,
        parishName: p.parish?.name,
        deaneryName: p.parish?.deanery?.name,
      });
    });
  }

  return results.slice(0, limit);
}
