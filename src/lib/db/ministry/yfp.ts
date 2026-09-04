import { supabase } from "@/integrations/supabase/client";

// Types
export type YFPCurriculum = {
  id: string;
  title: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type YFPPillar = {
  id: string;
  curriculum_id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  article_count?: number;
};

export type YFPArticle = {
  id: string;
  curriculum_id: string;
  pillar_id: string;
  article_number: number;
  title: string;
  content: string;
  scriptural_references: string[];
  tags: string[];
  discussion_points: string[];
  created_at: string;
  updated_at: string;
};

export type YFPYouthProgress = {
  id: string;
  youth_id: string;
  article_id: string;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type YFPCurriculumInput = {
  title: string;
  description?: string | null;
};

export type YFPPillarInput = {
  curriculum_id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  sort_order?: number;
};

export type YFPArticleInput = {
  curriculum_id: string;
  pillar_id: string;
  article_number?: number;
  title: string;
  content: string;
  scriptural_references?: string[];
  tags?: string[];
  discussion_points?: string[];
};

export type YFPProgressInput = {
  youth_id: string;
  article_id: string;
  completed_at?: string | null;
  notes?: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ============ CURRICULA ============

export async function listYFPCurricula(
  activeOnly = true
): Promise<YFPCurriculum[]> {
  let q = db
    .from("yfp_curricula")
    .select("*")
    .order("created_at", { ascending: false });

  if (activeOnly) {
    q = q.eq("is_active", true);
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as YFPCurriculum[];
}

export async function getYFPCurriculum(id: string): Promise<YFPCurriculum> {
  const { data, error } = await db
    .from("yfp_curricula")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as YFPCurriculum;
}

export async function createYFPCurriculum(
  input: YFPCurriculumInput
): Promise<YFPCurriculum> {
  const { data, error } = await db
    .from("yfp_curricula")
    .insert({
      title: input.title.trim(),
      description: input.description || null,
      is_active: true,
    })
    .select()
    .single();
  if (error) throw error;
  return data as YFPCurriculum;
}

export async function updateYFPCurriculum(
  id: string,
  input: YFPCurriculumInput
): Promise<YFPCurriculum> {
  const { data, error } = await db
    .from("yfp_curricula")
    .update({
      title: input.title.trim(),
      description: input.description || null,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as YFPCurriculum;
}

export async function archiveYFPCurriculum(id: string): Promise<YFPCurriculum> {
  const { data, error } = await db
    .from("yfp_curricula")
    .update({ is_active: false })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as YFPCurriculum;
}

export async function deleteYFPCurriculum(id: string): Promise<void> {
  const { error } = await db.from("yfp_curricula").delete().eq("id", id);
  if (error) throw error;
}

// ============ PILLARS ============

export async function listYFPPillars(curriculumId: string): Promise<YFPPillar[]> {
  const { data, error } = await db
    .from("yfp_pillars")
    .select("*")
    .eq("curriculum_id", curriculumId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as YFPPillar[];
}

export async function getYFPPillar(id: string): Promise<YFPPillar> {
  const { data, error } = await db
    .from("yfp_pillars")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as YFPPillar;
}

export async function createYFPPillar(
  input: YFPPillarInput
): Promise<YFPPillar> {
  const { data, error } = await db
    .from("yfp_pillars")
    .insert({
      curriculum_id: input.curriculum_id,
      name: input.name.trim(),
      description: input.description || null,
      icon: input.icon || null,
      color: input.color || null,
      sort_order: input.sort_order ?? 0,
    })
    .select()
    .single();
  if (error) throw error;
  return data as YFPPillar;
}

export async function updateYFPPillar(
  id: string,
  input: Partial<YFPPillarInput>
): Promise<YFPPillar> {
  const updateData: any = {};
  if (input.name) updateData.name = input.name.trim();
  if (input.description !== undefined)
    updateData.description = input.description;
  if (input.icon !== undefined) updateData.icon = input.icon;
  if (input.color !== undefined) updateData.color = input.color;
  if (input.sort_order !== undefined) updateData.sort_order = input.sort_order;

  const { data, error } = await db
    .from("yfp_pillars")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as YFPPillar;
}

export async function deleteYFPPillar(id: string): Promise<void> {
  const { error } = await db.from("yfp_pillars").delete().eq("id", id);
  if (error) throw error;
}

export async function reorderYFPPillars(
  curriculumId: string,
  pillars: { id: string; sort_order: number }[]
): Promise<void> {
  // Batch update sort_order for multiple pillars
  const updates = pillars.map((p) => ({
    id: p.id,
    sort_order: p.sort_order,
  }));

  for (const update of updates) {
    const { error } = await db
      .from("yfp_pillars")
      .update({ sort_order: update.sort_order })
      .eq("id", update.id);
    if (error) throw error;
  }
}

// ============ ARTICLES ============

export async function listYFPArticles(
  curriculumId: string,
  pillarId?: string
): Promise<YFPArticle[]> {
  let q = db
    .from("yfp_articles")
    .select("*")
    .eq("curriculum_id", curriculumId)
    .order("pillar_id", { ascending: true })
    .order("article_number", { ascending: true });

  if (pillarId) {
    q = q.eq("pillar_id", pillarId);
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as YFPArticle[];
}

export async function getYFPArticle(id: string): Promise<YFPArticle> {
  const { data, error } = await db
    .from("yfp_articles")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as YFPArticle;
}

export async function getNextArticleNumber(
  curriculumId: string,
  pillarId: string
): Promise<number> {
  const { data, error } = await db
    .from("yfp_articles")
    .select("article_number")
    .eq("curriculum_id", curriculumId)
    .eq("pillar_id", pillarId)
    .order("article_number", { ascending: false })
    .limit(1);

  if (error) throw error;
  return (data?.[0]?.article_number ?? 0) + 1;
}

export async function createYFPArticle(
  input: YFPArticleInput
): Promise<YFPArticle> {
  // Get next article number if not provided
  const articleNumber =
    input.article_number ??
    (await getNextArticleNumber(input.curriculum_id, input.pillar_id));

  const { data, error } = await db
    .from("yfp_articles")
    .insert({
      curriculum_id: input.curriculum_id,
      pillar_id: input.pillar_id,
      article_number: articleNumber,
      title: input.title.trim(),
      content: input.content,
      scriptural_references: input.scriptural_references || [],
      tags: input.tags || [],
      discussion_points: input.discussion_points || [],
    })
    .select()
    .single();
  if (error) throw error;
  return data as YFPArticle;
}

export async function updateYFPArticle(
  id: string,
  input: Partial<YFPArticleInput>
): Promise<YFPArticle> {
  const updateData: any = {};
  if (input.title) updateData.title = input.title.trim();
  if (input.content !== undefined) updateData.content = input.content;
  if (input.scriptural_references !== undefined)
    updateData.scriptural_references = input.scriptural_references;
  if (input.tags !== undefined) updateData.tags = input.tags;
  if (input.discussion_points !== undefined)
    updateData.discussion_points = input.discussion_points;

  const { data, error } = await db
    .from("yfp_articles")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as YFPArticle;
}

export async function deleteYFPArticle(id: string): Promise<void> {
  const { error } = await db.from("yfp_articles").delete().eq("id", id);
  if (error) throw error;
}

export async function reorderYFPArticles(
  curriculumId: string,
  pillarId: string,
  articles: { id: string; article_number: number }[]
): Promise<void> {
  // Batch update article numbers
  for (const article of articles) {
    const { error } = await db
      .from("yfp_articles")
      .update({ article_number: article.article_number })
      .eq("id", article.id);
    if (error) throw error;
  }
}

// ============ YOUTH PROGRESS ============

export async function listYFPYouthProgress(
  youthId: string
): Promise<YFPYouthProgress[]> {
  const { data, error } = await db
    .from("yfp_youth_progress")
    .select("*")
    .eq("youth_id", youthId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as YFPYouthProgress[];
}

export async function getYFPYouthProgress(
  youthId: string,
  articleId: string
): Promise<YFPYouthProgress | null> {
  const { data, error } = await db
    .from("yfp_youth_progress")
    .select("*")
    .eq("youth_id", youthId)
    .eq("article_id", articleId)
    .single();

  if (error?.code === "PGRST116") return null; // No rows found
  if (error) throw error;
  return data as YFPYouthProgress;
}

export async function markYFPArticleComplete(
  youthId: string,
  articleId: string,
  notes?: string
): Promise<YFPYouthProgress> {
  const { data, error } = await db
    .from("yfp_youth_progress")
    .upsert(
      {
        youth_id: youthId,
        article_id: articleId,
        completed_at: new Date().toISOString(),
        notes: notes || null,
      },
      { onConflict: "youth_id,article_id" }
    )
    .select()
    .single();
  if (error) throw error;
  return data as YFPYouthProgress;
}

export async function removeYFPArticleProgress(
  youthId: string,
  articleId: string
): Promise<void> {
  const { error } = await db
    .from("yfp_youth_progress")
    .delete()
    .eq("youth_id", youthId)
    .eq("article_id", articleId);
  if (error) throw error;
}

export async function getYFPCurriculumProgress(
  youthId: string,
  curriculumId: string
): Promise<{
  total_articles: number;
  completed_articles: number;
  completion_percentage: number;
}> {
  // Get total articles in curriculum
  const { data: articles, error: articlesError } = await db
    .from("yfp_articles")
    .select("id")
    .eq("curriculum_id", curriculumId);

  if (articlesError) throw articlesError;

  const totalArticles = articles?.length ?? 0;

  // Get completed articles for this youth
  const { data: progress, error: progressError } = await db
    .from("yfp_youth_progress")
    .select("id")
    .eq("youth_id", youthId)
    .in(
      "article_id",
      articles?.map((a: any) => a.id) ?? []
    )
    .not("completed_at", "is", null);

  if (progressError) throw progressError;

  const completedArticles = progress?.length ?? 0;

  return {
    total_articles: totalArticles,
    completed_articles: completedArticles,
    completion_percentage:
      totalArticles === 0 ? 0 : Math.round((completedArticles / totalArticles) * 100),
  };
}

export async function getYFPPillarProgress(
  youthId: string,
  pillarId: string
): Promise<{
  total_articles: number;
  completed_articles: number;
  completion_percentage: number;
}> {
  // Get articles in pillar
  const { data: articles, error: articlesError } = await db
    .from("yfp_articles")
    .select("id")
    .eq("pillar_id", pillarId);

  if (articlesError) throw articlesError;

  const totalArticles = articles?.length ?? 0;

  // Get completed articles
  const { data: progress, error: progressError } = await db
    .from("yfp_youth_progress")
    .select("id")
    .eq("youth_id", youthId)
    .in(
      "article_id",
      articles?.map((a: any) => a.id) ?? []
    )
    .not("completed_at", "is", null);

  if (progressError) throw progressError;

  const completedArticles = progress?.length ?? 0;

  return {
    total_articles: totalArticles,
    completed_articles: completedArticles,
    completion_percentage:
      totalArticles === 0 ? 0 : Math.round((completedArticles / totalArticles) * 100),
  };
}
