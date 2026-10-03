import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/database.types";

type YfpPillar = Database["public"]["Tables"]["yfp_pillars"]["Row"];
type YfpSubPillar = Database["public"]["Tables"]["yfp_sub_pillars"]["Row"];
type YfpWeeklyArticle = Database["public"]["Tables"]["yfp_weekly_articles"]["Row"];
type YfpYouthInquiry = Database["public"]["Tables"]["yfp_youth_inquiries"]["Row"];

// ============================================================
// FORMATION PILLARS
// ============================================================

export async function fetchPillars() {
  const { data, error } = await supabase.from("yfp_pillars").select("*").order("canonical_index");
  if (error) throw error;
  return data;
}

export async function fetchPillarById(id: string) {
  const { data, error } = await supabase.from("yfp_pillars").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

export async function createPillar(
  pillar: Omit<
    YfpPillar,
    "id" | "created_at" | "updated_at" | "created_by" | "updated_by" | "deleted_at" | "deleted_by"
  >,
) {
  const { data, error } = await supabase.from("yfp_pillars").insert([pillar]).select().single();
  if (error) throw error;
  return data;
}

export async function updatePillar(id: string, updates: Partial<YfpPillar>) {
  const { data, error } = await supabase
    .from("yfp_pillars")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deletePillar(id: string) {
  const { error } = await supabase
    .from("yfp_pillars")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// ============================================================
// SUB-PILLARS / GRADE TRACKS
// ============================================================

export async function fetchSubPillarsByPillarId(pillarId: string) {
  const { data, error } = await supabase
    .from("yfp_sub_pillars")
    .select("*")
    .eq("pillar_id", pillarId)
    .order("track_number");
  if (error) throw error;
  return data;
}

export async function fetchSubPillarById(id: string) {
  const { data, error } = await supabase.from("yfp_sub_pillars").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

export async function createSubPillar(
  subPillar: Omit<
    YfpSubPillar,
    "id" | "created_at" | "updated_at" | "created_by" | "updated_by" | "deleted_at" | "deleted_by"
  >,
) {
  const { data, error } = await supabase
    .from("yfp_sub_pillars")
    .insert([subPillar])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSubPillar(id: string, updates: Partial<YfpSubPillar>) {
  const { data, error } = await supabase
    .from("yfp_sub_pillars")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSubPillar(id: string) {
  const { error } = await supabase
    .from("yfp_sub_pillars")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// ============================================================
// WEEKLY ARTICLES
// ============================================================

export async function fetchWeeklyArticlesBySubPillarId(
  subPillarId: string,
  options?: { search?: string; status?: string; sort?: string },
) {
  let query = supabase.from("yfp_weekly_articles").select("*").eq("sub_pillar_id", subPillarId);

  if (options?.status) {
    query = query.eq("status", options.status);
  }

  if (options?.search) {
    query = query.or(
      `article_title.ilike.%${options.search}%,handbook_page_reference.ilike.%${options.search}%`,
    );
  }

  // Sort handling
  if (options?.sort === "newest") {
    query = query.order("sunday_date", { ascending: false });
  } else if (options?.sort === "title") {
    query = query.order("article_title", { ascending: true });
  } else {
    query = query.order("week_number", { ascending: true });
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function fetchWeeklyArticleById(id: string) {
  const { data, error } = await supabase
    .from("yfp_weekly_articles")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createWeeklyArticle(
  article: Omit<
    YfpWeeklyArticle,
    "id" | "created_at" | "updated_at" | "created_by" | "updated_by" | "deleted_at" | "deleted_by"
  >,
) {
  const { data, error } = await supabase
    .from("yfp_weekly_articles")
    .insert([article])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateWeeklyArticle(id: string, updates: Partial<YfpWeeklyArticle>) {
  const { data, error } = await supabase
    .from("yfp_weekly_articles")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteWeeklyArticle(id: string) {
  const { error } = await supabase
    .from("yfp_weekly_articles")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// ============================================================
// YOUTH INQUIRIES
// ============================================================

export async function fetchYouthInquiries(options?: {
  status?: string;
  search?: string;
  sort?: string;
}) {
  let query = supabase.from("yfp_youth_inquiries").select("*");

  if (options?.status && options.status !== "all") {
    query = query.eq("status", options.status);
  }

  if (options?.search) {
    query = query.or(
      `question_text.ilike.%${options.search}%,inquiry_reference.ilike.%${options.search}%`,
    );
  }

  if (options?.sort === "upvotes") {
    query = query.order("upvotes_count", { ascending: false });
  } else {
    query = query.order("submitted_at", { ascending: false });
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function fetchYouthInquiryById(id: string) {
  const { data, error } = await supabase
    .from("yfp_youth_inquiries")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createYouthInquiry(
  inquiry: Omit<
    YfpYouthInquiry,
    "id" | "created_at" | "updated_at" | "created_by" | "updated_by" | "deleted_at" | "deleted_by"
  >,
) {
  const { data, error } = await supabase
    .from("yfp_youth_inquiries")
    .insert([inquiry])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateYouthInquiry(id: string, updates: Partial<YfpYouthInquiry>) {
  const { data, error } = await supabase
    .from("yfp_youth_inquiries")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteYouthInquiry(id: string) {
  const { error } = await supabase
    .from("yfp_youth_inquiries")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
