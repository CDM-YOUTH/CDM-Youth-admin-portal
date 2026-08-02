import { createAPIFileRoute } from "@tanstack/react-start/api";
import { guardRequest, createServerClient, parsePagination, jsonOk, jsonError } from "@/lib/api/server-client";

export const APIRoute = createAPIFileRoute("/api/welfare")({
  GET: async ({ request }) => {
    const guard = await guardRequest(request);
    if ("error" in guard) return guard.error;

    const url = new URL(request.url);
    const { page, size } = parsePagination(url);
    const q = url.searchParams.get("q")?.trim() ?? "";
    const status = url.searchParams.get("status");
    const urgency = url.searchParams.get("urgency");

    const db = createServerClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (db as any)
      .from("welfare_cases")
      .select("*", { count: "exact" })
      .order("opened_at", { ascending: false })
      .range(page * size, page * size + size - 1);

    if (status) query = query.eq("status", status);
    if (urgency) query = query.eq("urgency", urgency);
    if (q) {
      const term = `%${q}%`;
      query = query.or(
        `case_ref.ilike.${term},category.ilike.${term},cdm_id.ilike.${term},parish_name.ilike.${term}`,
      );
    }

    const { data, error, count } = await query;
    if (error) return jsonError(error.message, 500);

    return jsonOk({ data: data ?? [], total: count ?? 0, page, size });
  },
});
