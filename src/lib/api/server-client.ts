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

// Convenience: verify auth + rate-limit in one call.
// Returns { error: Response } when blocked, or { userId } when clear.
export async function guardRequest(
  request: Request,
): Promise<{ error: Response } | { userId: string }> {
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

  return { userId: auth.userId };
}
