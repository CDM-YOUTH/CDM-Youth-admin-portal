import { createAPIFileRoute } from "@tanstack/react-start/api";
import { guardRequest, createServerClient, parsePagination, jsonOk, jsonError, isStaff } from "@/lib/api/server-client";
import { likePattern } from "@/lib/utils";

export const APIRoute = createAPIFileRoute("/api/uniforms/orders")({
  GET: async ({ request }) => {
    const guard = await guardRequest(request);
    if ("error" in guard) return guard.error;
    if (!isStaff(guard.role)) return jsonError("Forbidden", 403);

    const url = new URL(request.url);
    const { page, size } = parsePagination(url);
    const q = url.searchParams.get("q")?.trim() ?? "";
    const status = url.searchParams.get("status");
    const deaneryId = url.searchParams.get("deanery_id");

    const db = createServerClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (db as any)
      .from("uniform_orders")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * size, page * size + size - 1);

    if (status) query = query.eq("status", status);
    if (deaneryId) query = query.eq("deanery_id", deaneryId);
    if (q) {
      const term = likePattern(q);
      query = query.or(
        `item_name.ilike.${term},supplier.ilike.${term},deanery_name.ilike.${term}`,
      );
    }

    const { data, error, count } = await query;
    if (error) return jsonError(error.message, 500);

    return jsonOk({ data: data ?? [], total: count ?? 0, page, size });
  },
});
