import { createAPIFileRoute } from "@tanstack/react-start/api";
import { guardRequest, createServerClient, parsePagination, jsonOk, jsonError, applyCallerScope } from "@/lib/api/server-client";
import { likePattern } from "@/lib/utils";

export const APIRoute = createAPIFileRoute("/api/events")({
  GET: async ({ request }) => {
    const guard = await guardRequest(request);
    if ("error" in guard) return guard.error;

    const url = new URL(request.url);
    const { page, size } = parsePagination(url);
    const q = url.searchParams.get("q")?.trim() ?? "";

    // Enforce caller's assigned scope.
    const { deaneryId, parishId } = applyCallerScope(
      {
        deaneryId: url.searchParams.get("deanery_id"),
        parishId: url.searchParams.get("parish_id"),
      },
      guard,
    );

    const db = createServerClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (db as any)
      .from("events")
      .select(
        "id, name, event_date, venue, description, poster_url, organization_level, deanery:deaneries(name), parish:parishes(name)",
        { count: "exact" },
      )
      .order("event_date", { ascending: false })
      .range(page * size, page * size + size - 1);

    if (deaneryId) query = query.eq("deanery_id", deaneryId);
    if (parishId) query = query.eq("parish_id", parishId);
    if (q) {
      const term = likePattern(q);
      query = query.or(`name.ilike.${term},venue.ilike.${term},description.ilike.${term}`);
    }

    const { data, error, count } = await query;
    if (error) return jsonError(error.message, 500);

    return jsonOk({ data: data ?? [], total: count ?? 0, page, size });
  },
});
