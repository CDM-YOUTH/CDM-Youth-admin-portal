import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type AuthOk = { ok: true; userId: string; claims: Record<string, unknown> };
export type AuthFail = { ok: false; status: number; message: string };
export type AuthResult = AuthOk | AuthFail;

export async function verifyAuth(request: Request): Promise<AuthResult> {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    return { ok: false, status: 500, message: "Server misconfiguration" };
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false, status: 401, message: "Unauthorized" };
  }

  const token = authHeader.slice(7).trim();
  if (!token) return { ok: false, status: 401, message: "Unauthorized" };

  const client = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await client.auth.getClaims(token);
  if (error || !data?.claims?.sub) {
    return { ok: false, status: 401, message: "Invalid or expired token" };
  }

  return {
    ok: true,
    userId: data.claims.sub as string,
    claims: data.claims as Record<string, unknown>,
  };
}
