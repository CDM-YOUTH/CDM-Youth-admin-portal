import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { verifyAuth, type AuthFail } from "./auth";
import { checkRateLimit } from "./rate-limiter";

export function createServerClient() {
  const url = process.env.SUPABASE_URL;
  // Prefer service role key (bypasses RLS after our own auth check).
  // Falls back to publishable/anon key which still respects RLS.
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase server env vars not set");
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export type PageParams = { page: number; size: number };

export function parsePagination(url: URL, defaultSize = 25): PageParams {
  const page = Math.max(0, parseInt(url.searchParams.get("page") ?? "0", 10) || 0);
  const size = Math.min(
    100,
    Math.max(1, parseInt(url.searchParams.get("size") ?? String(defaultSize), 10) || defaultSize),
  );
  return { page, size };
}

export function jsonOk(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export function jsonError(message: string, status: number, extra?: Record<string, unknown>): Response {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (extra?.retryAfter) headers["Retry-After"] = String(extra.retryAfter);
  return new Response(JSON.stringify({ error: message, ...extra }), { status, headers });
}

export function authError(fail: AuthFail): Response {
  return jsonError(fail.message, fail.status);
}

// If the calling user has an assigned org scope, override the requested org
// params to match their scope — preventing a scoped user from querying outside
// their assigned deanery/parish.
export function applyCallerScope(
  requested: { deaneryId?: string | null; parishId?: string | null },
  caller: { scopeDeaneryId: string | null; scopeParishId: string | null },
): { deaneryId: string | null; parishId: string | null } {
  return {
    deaneryId: caller.scopeDeaneryId ?? requested.deaneryId ?? null,
    parishId: caller.scopeParishId ?? requested.parishId ?? null,
  };
}

export const STAFF_ROLES = ["admin", "office", "moderator"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export function isStaff(role: string): boolean {
  return (STAFF_ROLES as readonly string[]).includes(role);
}

// Convenience: verify auth + rate-limit in one call.
// Returns { error: Response } when blocked, or { userId, role, scopeDeaneryId, scopeParishId } when clear.
export async function guardRequest(
  request: Request,
): Promise<{ error: Response } | { userId: string; role: string; scopeDeaneryId: string | null; scopeParishId: string | null }> {
  const auth = await verifyAuth(request);
  if (!auth.ok) return { error: authError(auth) };

  const limit = checkRateLimit(auth.userId);
  if (!limit.allowed) {
    return {
      error: jsonError("Too many requests — slow down", 429, {
        retryAfter: limit.retryAfter,
      }),
    };
  }

  // Fetch role + org scope in parallel for downstream authorization checks.
  const db = createServerClient();
  const [roleResult, profileResult] = await Promise.all([
    db.from("user_roles").select("role").eq("user_id", auth.userId).maybeSingle(),
    db.from("profiles").select("deanery_id, parish_id").eq("id", auth.userId).maybeSingle(),
  ]);
  const role = (roleResult.data as { role?: string } | null)?.role ?? "user";
  const profileData = profileResult.data as { deanery_id?: string | null; parish_id?: string | null } | null;
  const scopeDeaneryId = profileData?.deanery_id ?? null;
  const scopeParishId = profileData?.parish_id ?? null;

  return { userId: auth.userId, role, scopeDeaneryId, scopeParishId };
}
