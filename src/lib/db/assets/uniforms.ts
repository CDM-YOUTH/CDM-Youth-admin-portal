import { supabase } from "@/integrations/supabase/client";

export type UniformSku = {
  id: string;
  name: string;
  swatch: string | null;
  in_stock: number;
  on_order: number;
  unit_price: number | null;
  created_at: string;
};

export type OrderStatus = "pending" | "ordered" | "received" | "cancelled";

export type UniformOrder = {
  id: string;
  sku_id: string | null;
  item_name: string;
  quantity: number;
  supplier: string | null;
  deanery_id: string | null;
  deanery_name: string | null;
  estimated_delivery: string | null;
  status: OrderStatus;
  notes: string | null;
  created_at: string;
};

export type UniformOrderInput = {
  itemName: string;
  quantity: number;
  supplier?: string | null;
  deaneryName?: string | null;
  estimatedDelivery?: string | null;
  notes?: string | null;
};

export type UniformOrderUpdateInput = {
  itemName: string;
  quantity: number;
  supplier?: string | null;
  deaneryName?: string | null;
  estimatedDelivery?: string | null;
  status: OrderStatus;
  notes?: string | null;
};

export type UniformSkuInput = {
  name: string;
  inStock: number;
  onOrder?: number;
  unitPrice?: number | null;
  swatch?: string | null;
};

export type UniformSkuUpdateInput = {
  name: string;
  inStock: number;
  onOrder: number;
  unitPrice?: number | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export async function listUniformSkus(): Promise<UniformSku[]> {
  const { data, error } = await db.from("uniform_skus").select("*").order("name");
  if (error) throw error;
  return (data ?? []) as UniformSku[];
}

export async function listUniformOrders(limit = 100): Promise<UniformOrder[]> {
  const { data, error } = await db
    .from("uniform_orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as UniformOrder[];
}

export async function createUniformOrder(input: UniformOrderInput): Promise<UniformOrder> {
  let skuId: string | null = null;
  if (input.itemName) {
    const { data: sku } = await db
      .from("uniform_skus")
      .select("id")
      .eq("name", input.itemName)
      .maybeSingle();
    skuId = (sku as { id: string } | null)?.id ?? null;
  }

  let deaneryId: string | null = null;
  if (input.deaneryName?.trim()) {
    const { data: d } = await supabase
      .from("deaneries")
      .select("id")
      .eq("name", input.deaneryName.trim())
      .maybeSingle();
    deaneryId = (d as { id: string } | null)?.id ?? null;
  }

  const { data, error } = await db
    .from("uniform_orders")
    .insert({
      sku_id: skuId,
      item_name: input.itemName,
      quantity: input.quantity,
      supplier: input.supplier || null,
      deanery_id: deaneryId,
      deanery_name: input.deaneryName || null,
      estimated_delivery: input.estimatedDelivery || null,
      notes: input.notes || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as UniformOrder;
}

export async function updateUniformOrder(id: string, input: UniformOrderUpdateInput): Promise<UniformOrder> {
  let skuId: string | null = null;
  if (input.itemName) {
    const { data: sku } = await db
      .from("uniform_skus")
      .select("id")
      .eq("name", input.itemName)
      .maybeSingle();
    skuId = (sku as { id: string } | null)?.id ?? null;
  }

  let deaneryId: string | null = null;
  if (input.deaneryName?.trim()) {
    const { data: d } = await supabase
      .from("deaneries")
      .select("id")
      .eq("name", input.deaneryName.trim())
      .maybeSingle();
    deaneryId = (d as { id: string } | null)?.id ?? null;
  }

  const { data, error } = await db
    .from("uniform_orders")
    .update({
      sku_id: skuId,
      item_name: input.itemName,
      quantity: input.quantity,
      supplier: input.supplier || null,
      deanery_id: deaneryId,
      deanery_name: input.deaneryName || null,
      estimated_delivery: input.estimatedDelivery || null,
      status: input.status,
      notes: input.notes || null,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as UniformOrder;
}

export async function deleteUniformOrder(id: string): Promise<void> {
  const { error } = await db.from("uniform_orders").delete().eq("id", id);
  if (error) throw error;
}

export async function updateUniformSku(id: string, input: UniformSkuUpdateInput): Promise<UniformSku> {
  const { data, error } = await db
    .from("uniform_skus")
    .update({
      name: input.name,
      in_stock: input.inStock,
      on_order: input.onOrder,
      unit_price: input.unitPrice ?? null,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as UniformSku;
}

export async function deleteUniformSku(id: string): Promise<void> {
  const { error } = await db.from("uniform_skus").delete().eq("id", id);
  if (error) throw error;
}

export async function createUniformSku(input: UniformSkuInput): Promise<UniformSku> {
  const { data, error } = await db
    .from("uniform_skus")
    .insert({
      name:       input.name,
      in_stock:   input.inStock,
      on_order:   input.onOrder  ?? 0,
      unit_price: input.unitPrice ?? null,
      swatch:     input.swatch   ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as UniformSku;
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<void> {
  const { error } = await db.from("uniform_orders").update({ status }).eq("id", id);
  if (error) throw error;
}
