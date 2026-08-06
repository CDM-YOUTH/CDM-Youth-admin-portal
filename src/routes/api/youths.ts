import { createAPIFileRoute } from "@tanstack/react-start/api";
import { guardRequest, createServerClient, parsePagination, jsonOk, jsonError, applyCallerScope } from "@/lib/api/server-client";
import { likePattern } from "@/lib/utils";

export const APIRoute = createAPIFileRoute("/api/youths")({
  GET: async ({ request }) => {
    const guard = await guardRequest(request);
    if ("error" in guard) return guard.error;

    const url = new URL(request.url);
    const { page, size } = parsePagination(url);
    const q = url.searchParams.get("q")?.trim() ?? "";
    const youthId = url.searchParams.get("youth_id");
    const outstationId = url.searchParams.get("outstation_id");
    const category = url.searchParams.get("category");
    const status = url.searchParams.get("status");

    // Enforce caller's assigned scope — a scoped user cannot query outside their org.
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
      .from("youths")
      .select(
        "*, deanery:deaneries(name), parish:parishes(name), outstation:outstations(name), enrollments(id)",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(page * size, page * size + size - 1);

    if (youthId) query = query.eq("id", youthId);
    if (deaneryId) query = query.eq("deanery_id", deaneryId);
    if (parishId) query = query.eq("parish_id", parishId);
    if (outstationId) query = query.eq("outstation_id", outstationId);
    if (category) query = query.eq("category", category);
    if (status) query = query.eq("status", status);
    if (q) {
      const term = likePattern(q);
      query = query.or(`full_name.ilike.${term},cdm_id.ilike.${term},phone.ilike.${term}`);
    }

    const { data, error, count } = await query;
    if (error) return jsonError(error.message, 500);

    return jsonOk({ data: data ?? [], total: count ?? 0, page, size });
  },
});
