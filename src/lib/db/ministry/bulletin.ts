import { supabase } from "@/integrations/supabase/client";

// Types
export type BulletinCategory = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type BulletinItem = {
  id: string;
  category_id: string | null;
  title: string;
  kind: "PDF" | "Audio" | "Video" | "Image" | "Other";
  duration: string | null;
  author: string | null;
  tags: string[];
  description: string | null;
  file_url: string | null;
  views: number;
  published: boolean;
  created_at: string;
  category?: BulletinCategory;
};

export type BulletinItemInput = {
  title: string;
  kind: "PDF" | "Audio" | "Video" | "Image" | "Other";
  category_id?: string | null;
  duration?: string | null;
  author?: string | null;
  tags?: string | null;
  description?: string | null;
  fileUrl?: string | null;
};

export type BulletinCategoryInput = {
  name: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  sort_order?: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ============ CATEGORIES ============

export async function listBulletinCategories(): Promise<BulletinCategory[]> {
  const { data, error } = await db
    .from("bulletin_categories")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as BulletinCategory[];
}

export async function getBulletinCategory(id: string): Promise<BulletinCategory> {
  const { data, error } = await db.from("bulletin_categories").select("*").eq("id", id).single();
  if (error) throw error;
  return data as BulletinCategory;
}

export async function createBulletinCategory(
  input: BulletinCategoryInput,
): Promise<BulletinCategory> {
  const { data, error } = await db
    .from("bulletin_categories")
    .insert({
      name: input.name.trim(),
      description: input.description || null,
      icon: input.icon || null,
      color: input.color || null,
      sort_order: input.sort_order ?? 0,
    })
    .select()
    .single();
  if (error) throw error;
  return data as BulletinCategory;
}

export async function updateBulletinCategory(
  id: string,
  input: BulletinCategoryInput,
): Promise<BulletinCategory> {
  const { data, error } = await db
    .from("bulletin_categories")
    .update({
      name: input.name.trim(),
      description: input.description || null,
      icon: input.icon || null,
      color: input.color || null,
      sort_order: input.sort_order ?? 0,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as BulletinCategory;
}

export async function deleteBulletinCategory(id: string): Promise<void> {
  const { error } = await db.from("bulletin_categories").delete().eq("id", id);
  if (error) throw error;
}

// ============ BULLETIN ITEMS ============

export async function listBulletinItems(
  categoryId?: string,
  publishedOnly = true,
): Promise<BulletinItem[]> {
  let q = db
    .from("formation_items")
    .select(
      `
      *,
      bulletin_categories:category_id (*)
    `,
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (categoryId) {
    q = q.eq("category_id", categoryId);
  }

  if (publishedOnly) {
    q = q.eq("published", true);
  }

  const { data, error } = await q;
  if (error) throw error;

  return (data ?? []).map((item: any) => ({
    ...item,
    category: item.bulletin_categories,
  })) as BulletinItem[];
}

export async function getBulletinItem(id: string): Promise<BulletinItem> {
  const { data, error } = await db
    .from("formation_items")
    .select(
      `
      *,
      bulletin_categories:category_id (*)
    `,
    )
    .eq("id", id)
    .single();
  if (error) throw error;
  return {
    ...data,
    category: data.bulletin_categories,
  } as BulletinItem;
}

export async function createBulletinItem(input: BulletinItemInput): Promise<BulletinItem> {
  const tags = input.tags
    ? input.tags
        .split(",")
        .map((t: string) => t.trim())
        .filter(Boolean)
    : [];

  const { data, error } = await db
    .from("formation_items")
    .insert({
      title: input.title.trim(),
      kind: input.kind,
      category_id: input.category_id || null,
      duration: input.duration || null,
      author: input.author || null,
      tags,
      description: input.description || null,
      file_url: input.fileUrl || null,
      published: true,
    })
    .select(
      `
      *,
      bulletin_categories:category_id (*)
    `,
    )
    .single();
  if (error) throw error;
  return {
    ...data,
    category: data.bulletin_categories,
  } as BulletinItem;
}

export async function updateBulletinItem(
  id: string,
  input: BulletinItemInput,
): Promise<BulletinItem> {
  const tags = input.tags
    ? input.tags
        .split(",")
        .map((t: string) => t.trim())
        .filter(Boolean)
    : [];

  const { data, error } = await db
    .from("formation_items")
    .update({
      title: input.title.trim(),
      kind: input.kind,
      category_id: input.category_id || null,
      duration: input.duration || null,
      author: input.author || null,
      tags,
      description: input.description || null,
      file_url: input.fileUrl || null,
    })
    .eq("id", id)
    .select(
      `
      *,
      bulletin_categories:category_id (*)
    `,
    )
    .single();
  if (error) throw error;
  return {
    ...data,
    category: data.bulletin_categories,
  } as BulletinItem;
}

export async function deleteBulletinItem(id: string): Promise<void> {
  const { error } = await db.from("formation_items").delete().eq("id", id);
  if (error) throw error;
}

export async function publishBulletinItem(id: string): Promise<BulletinItem> {
  return updateBulletinItemPublish(id, true);
}

export async function unpublishBulletinItem(id: string): Promise<BulletinItem> {
  return updateBulletinItemPublish(id, false);
}

async function updateBulletinItemPublish(id: string, published: boolean): Promise<BulletinItem> {
  const { data, error } = await db
    .from("formation_items")
    .update({ published })
    .eq("id", id)
    .select(
      `
      *,
      bulletin_categories:category_id (*)
    `,
    )
    .single();
  if (error) throw error;
  return {
    ...data,
    category: data.bulletin_categories,
  } as BulletinItem;
}
