import { supabase } from "@/integrations/supabase/client";

export type FormationKind = "PDF" | "Audio" | "Video" | "Image" | "Other";

export type FormationItem = {
  id: string;
  title: string;
  kind: FormationKind;
  duration: string | null;
  author: string | null;
  tags: string[];
  description: string | null;
  file_url: string | null;
  views: number;
  published: boolean;
  created_at: string;
};

export type FormationItemInput = {
  title: string;
  kind: FormationKind;
  duration?: string | null;
  author?: string | null;
  tags?: string | null;
  description?: string | null;
  fileUrl?: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export async function listFormationItems(publishedOnly = true): Promise<FormationItem[]> {
  let q = db
    .from("formation_items")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (publishedOnly) q = q.eq("published", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as FormationItem[];
}

export async function createFormationItem(input: FormationItemInput): Promise<FormationItem> {
  const tags = input.tags
    ? input.tags.split(",").map((t: string) => t.trim()).filter(Boolean)
    : [];

  const { data, error } = await db
    .from("formation_items")
    .insert({
      title: input.title.trim(),
      kind: input.kind,
      duration: input.duration || null,
      author: input.author || null,
      tags,
      description: input.description || null,
      file_url: input.fileUrl || null,
      published: true,
    })
    .select()
    .single();
  if (error) throw error;
  return data as FormationItem;
}

export async function updateFormationItem(id: string, input: FormationItemInput): Promise<FormationItem> {
  const tags = input.tags
    ? input.tags.split(",").map((t: string) => t.trim()).filter(Boolean)
    : [];

  const { data, error } = await db
    .from("formation_items")
    .update({
      title: input.title.trim(),
      kind: input.kind,
      duration: input.duration || null,
      author: input.author || null,
      tags,
      description: input.description || null,
      file_url: input.fileUrl || null,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as FormationItem;
}

export async function deleteFormationItem(id: string): Promise<void> {
  const { error } = await db.from("formation_items").delete().eq("id", id);
  if (error) throw error;
}
