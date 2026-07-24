import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  position: string | null;
  deanery_id: string | null;
  parish_id: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type ProfileWithOrg = Profile & {
  deanery: { id: string; name: string } | null;
  parish: { id: string; name: string } | null;
};

/** Fetch the profile for the currently signed-in user. */
export async function getMyProfile(): Promise<Profile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) throw error;
  return data;
}

/** Fetch all profiles (admin use). */
export async function getAllProfiles(): Promise<ProfileWithOrg[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*, deanery:deaneries(id,name), parish:parishes(id,name)")
    .order("full_name");

  if (error) throw error;
  return (data ?? []) as ProfileWithOrg[];
}

/** Update a profile by id (user updates their own, admin updates any). */
export async function updateProfile(
  id: string,
  input: Partial<Omit<Profile, "id" | "created_at" | "updated_at">>
): Promise<void> {
  const { error } = await supabase.from("profiles").update(input).eq("id", id);
  if (error) throw error;
}

/** Upsert role for a user (admin only). */
export async function setUserRole(
  userId: string,
  role: "admin" | "moderator" | "office" | "user"
): Promise<void> {
  const { error } = await supabase
    .from("user_roles")
    .upsert({ user_id: userId, role }, { onConflict: "user_id,role" });
  if (error) throw error;
}

/** Get the role for a given user id. */
export async function getUserRole(
  userId: string
): Promise<"admin" | "moderator" | "user" | null> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return (data?.role as "admin" | "moderator" | "user" | null) ?? null;
}
