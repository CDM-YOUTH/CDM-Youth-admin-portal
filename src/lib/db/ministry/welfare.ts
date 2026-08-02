import { supabase } from "@/integrations/supabase/client";

export type WelfareUrgency = "low" | "medium" | "high";
export type WelfareStatus  = "open" | "in_progress" | "resolved" | "closed";

export type WelfareCaseRow = {
  id: string;
  case_ref: string;
  category: string;
  urgency: WelfareUrgency;
  status: WelfareStatus;
  parish_id: string | null;
  parish_name: string | null;
  youth_id: string | null;
  cdm_id: string | null;
  assigned_to: string | null;
  notes: string | null;
  opened_at: string;
  resolved_at: string | null;
  created_at: string;
};

export type WelfareCaseInput = {
  category: string;
  urgency: WelfareUrgency;
  parishName?: string | null;
  cdmId?: string | null;
  assignedTo?: string | null;
  notes?: string | null;
};

export type WelfareCaseUpdateInput = {
  category: string;
  urgency: WelfareUrgency;
  status: WelfareStatus;
  parishName?: string | null;
  cdmId?: string | null;
  assignedTo?: string | null;
  notes?: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export async function listWelfareCases(limit = 100): Promise<WelfareCaseRow[]> {
  const { data, error } = await db
    .from("welfare_cases")
    .select("*")
    .order("opened_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as WelfareCaseRow[];
}

export async function createWelfareCase(input: WelfareCaseInput): Promise<WelfareCaseRow> {
  let parishId: string | null = null;
  if (input.parishName) {
    const { data: p } = await supabase
      .from("parishes")
      .select("id")
      .eq("name", input.parishName)
      .maybeSingle();
    parishId = (p as { id: string } | null)?.id ?? null;
  }

  let youthId: string | null = null;
  if (input.cdmId?.trim()) {
    const { data: y } = await supabase
      .from("youths")
      .select("id")
      .eq("cdm_id", input.cdmId.trim())
      .maybeSingle();
    youthId = (y as { id: string } | null)?.id ?? null;
  }

  const { data, error } = await db
    .from("welfare_cases")
    .insert({
      category: input.category,
      urgency: input.urgency,
      parish_id: parishId,
      parish_name: input.parishName || null,
      youth_id: youthId,
      cdm_id: input.cdmId?.trim() || null,
      assigned_to: input.assignedTo || null,
      notes: input.notes || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as WelfareCaseRow;
}

export async function updateWelfareCase(id: string, input: WelfareCaseUpdateInput): Promise<WelfareCaseRow> {
  let parishId: string | null = null;
  if (input.parishName) {
    const { data: p } = await supabase
      .from("parishes")
      .select("id")
      .eq("name", input.parishName)
      .maybeSingle();
    parishId = (p as { id: string } | null)?.id ?? null;
  }

  let youthId: string | null = null;
  if (input.cdmId?.trim()) {
    const { data: y } = await supabase
      .from("youths")
      .select("id")
      .eq("cdm_id", input.cdmId.trim())
      .maybeSingle();
    youthId = (y as { id: string } | null)?.id ?? null;
  }

  const patch: Record<string, unknown> = {
    category: input.category,
    urgency: input.urgency,
    status: input.status,
    parish_id: parishId,
    parish_name: input.parishName || null,
    youth_id: youthId,
    cdm_id: input.cdmId?.trim() || null,
    assigned_to: input.assignedTo || null,
    notes: input.notes || null,
  };
  if (input.status === "resolved" || input.status === "closed") {
    patch.resolved_at = new Date().toISOString();
  }

  const { data, error } = await db
    .from("welfare_cases")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as WelfareCaseRow;
}

export async function updateWelfareCaseStatus(id: string, status: WelfareStatus): Promise<void> {
  const patch: Record<string, unknown> = { status };
  if (status === "resolved" || status === "closed") patch.resolved_at = new Date().toISOString();
  const { error } = await db.from("welfare_cases").update(patch).eq("id", id);
  if (error) throw error;
}

export async function getWelfareKpis(): Promise<{
  open: number; urgent: number; inProgress: number; resolved30d: number;
}> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toISOString();
  const [openRes, urgentRes, inProgressRes, resolved30dRes] = await Promise.all([
    db.from("welfare_cases").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress"]),
    db.from("welfare_cases").select("id", { count: "exact", head: true }).eq("urgency", "high").in("status", ["open", "in_progress"]),
    db.from("welfare_cases").select("id", { count: "exact", head: true }).eq("status", "in_progress"),
    db.from("welfare_cases").select("id", { count: "exact", head: true }).in("status", ["resolved", "closed"]).gte("resolved_at", thirtyDaysAgo),
  ]);
  return {
    open: openRes.count ?? 0,
    urgent: urgentRes.count ?? 0,
    inProgress: inProgressRes.count ?? 0,
    resolved30d: resolved30dRes.count ?? 0,
  };
}

export async function listWelfareCasesPaged(opts: {
  page?: number;
  size?: number;
  q?: string;
  parishId?: string | null;
  status?: string | null;
  urgency?: string | null;
}): Promise<{ data: WelfareCaseRow[]; total: number; page: number; size: number }> {
  const page = opts.page ?? 0;
  const size = Math.min(opts.size ?? 25, 100);

  let query = db
    .from("welfare_cases")
    .select("*", { count: "exact" })
    .order("opened_at", { ascending: false })
    .range(page * size, page * size + size - 1);

  if (opts.parishId) query = query.eq("parish_id", opts.parishId);
  if (opts.status)   query = query.eq("status",    opts.status);
  if (opts.urgency)  query = query.eq("urgency",   opts.urgency);
  if (opts.q?.trim()) {
    const t = `%${opts.q.trim()}%`;
    query = query.or(`category.ilike.${t},assigned_to.ilike.${t},cdm_id.ilike.${t},parish_name.ilike.${t}`);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: (data ?? []) as WelfareCaseRow[], total: count ?? 0, page, size };
}

export async function deleteWelfareCase(id: string): Promise<void> {
  const { error } = await db.from("welfare_cases").delete().eq("id", id);
  if (error) throw error;
}
