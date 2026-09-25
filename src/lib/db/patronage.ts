import { supabase } from "@/integrations/supabase/client";
import { likePattern } from "@/lib/utils";

export type PatronageLevel = "outstation" | "parish" | "deanery" | "diocese";
export type Gender = "Male" | "Female";

export type PatronageTeamRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  gender: Gender;
  level: PatronageLevel;
  deanery_id: string | null;
  parish_id: string | null;
  outstation_id: string | null;
  start_date: string;
  created_at: string;
  deleted_at: string | null;
  deanery?: { name: string } | null;
  parish?: { name: string } | null;
  outstation?: { name: string } | null;
};

export type PatronageTeamInput = {
  name: string;
  phone?: string | null;
  email?: string | null;
  gender: Gender;
  level: PatronageLevel;
  deaneryId?: string | null;
  parishId?: string | null;
  outstationId?: string | null;
  startDate?: string;
};

export type PatronageTeamUpdate = Partial<PatronageTeamInput>;

export type PagedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  size: number;
};

const SEL =
  "*, deanery:deaneries(name), parish:parishes(name), outstation:outstations(name)";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => (supabase as any).from("patronage_team");

export async function listPatronagePaged(opts: {
  page?: number;
  size?: number;
  q?: string;
  level?: PatronageLevel;
  gender?: Gender;
  deaneryId?: string | null;
  parishId?: string | null;
  outstationId?: string | null;
  includeDeleted?: boolean;
}): Promise<PagedResponse<PatronageTeamRow>> {
  const page = opts.page ?? 0;
  const size = opts.size ?? 10;
  const offset = page * size;

  let q = db().select(SEL);

  // Filter by soft-delete status
  if (!opts.includeDeleted) {
    q = q.is("deleted_at", null);
  }

  // Filter by level
  if (opts.level) {
    q = q.eq("level", opts.level);
  }

  // Filter by gender
  if (opts.gender) {
    q = q.eq("gender", opts.gender);
  }

  // Filter by org hierarchy
  if (opts.outstationId) {
    q = q.eq("outstation_id", opts.outstationId);
  } else if (opts.parishId) {
    q = q.eq("parish_id", opts.parishId);
  } else if (opts.deaneryId) {
    q = q.eq("deanery_id", opts.deaneryId);
  }

  // Search by name or phone
  if (opts.q) {
    const pattern = likePattern(opts.q);
    q = q.or(`name.ilike.${pattern},phone.ilike.${pattern}`);
  }

  // Get total count
  const { count } = await q
    .select("*", { count: "exact", head: true });

  // Get paginated results
  const { data, error } = await q
    .order("start_date", { ascending: false })
    .range(offset, offset + size - 1);

  if (error) throw error;

  return {
    data: (data ?? []) as PatronageTeamRow[],
    total: count ?? 0,
    page,
    size,
  };
}

export async function getPatronage(id: string): Promise<PatronageTeamRow> {
  const { data, error } = await db()
    .select(SEL)
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as PatronageTeamRow;
}

export async function createPatronage(input: PatronageTeamInput): Promise<PatronageTeamRow> {
  const { data, error } = await db()
    .insert({
      name: input.name.trim(),
      phone: input.phone || null,
      email: input.email || null,
      gender: input.gender,
      level: input.level,
      deanery_id: input.deaneryId || null,
      parish_id: input.parishId || null,
      outstation_id: input.outstationId || null,
      start_date: input.startDate || new Date().toISOString().split('T')[0],
    })
    .select(SEL)
    .single();
  if (error) throw error;
  return data as PatronageTeamRow;
}

export async function updatePatronage(
  id: string,
  input: PatronageTeamUpdate
): Promise<PatronageTeamRow> {
  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.name = input.name.trim();
  if (input.phone !== undefined) updates.phone = input.phone;
  if (input.email !== undefined) updates.email = input.email;
  if (input.gender !== undefined) updates.gender = input.gender;
  if (input.level !== undefined) updates.level = input.level;
  if (input.deaneryId !== undefined) updates.deanery_id = input.deaneryId;
  if (input.parishId !== undefined) updates.parish_id = input.parishId;
  if (input.outstationId !== undefined) updates.outstation_id = input.outstationId;
  if (input.startDate !== undefined) updates.start_date = input.startDate;

  const { data, error } = await db()
    .update(updates)
    .eq("id", id)
    .select(SEL)
    .single();
  if (error) throw error;
  return data as PatronageTeamRow;
}

export async function deletePatronage(id: string): Promise<void> {
  const { error } = await db()
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function bulkDeletePatronage(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await db()
    .update({ deleted_at: new Date().toISOString() })
    .in("id", ids);
  if (error) throw error;
}
