import { createAPIFileRoute } from "@tanstack/react-start/api";
import { guardRequest, createServerClient, parsePagination, jsonOk, jsonError } from "@/lib/api/server-client";

export const APIRoute = createAPIFileRoute("/api/leaders")({
  GET: async ({ request }) => {
    const guard = await guardRequest(request);
    if ("error" in guard) return guard.error;

    const url = new URL(request.url);
    const { page, size } = parsePagination(url);
    const q = url.searchParams.get("q")?.trim() ?? "";
    const level = url.searchParams.get("level");
    const deaneryId = url.searchParams.get("deanery_id");
    const parishId = url.searchParams.get("parish_id");
    const outstationId = url.searchParams.get("outstation_id");
    const active = url.searchParams.get("active"); // "true" = only active (no end_date)

    const db = createServerClient();
    const SEL =
      "*, youth:youths(full_name,cdm_id,phone), role_type:leadership_role_types(name), deanery:deaneries(name), parish:parishes(name), outstation:outstations(name)";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (db as any)
      .from("youth_leadership_roles")
      .select(SEL, { count: "exact" })
      .order("start_date", { ascending: false })
      .range(page * size, page * size + size - 1);

    if (level) query = query.eq("level", level);
    if (deaneryId) query = query.eq("deanery_id", deaneryId);
    if (parishId) query = query.eq("parish_id", parishId);
    if (outstationId) query = query.eq("outstation_id", outstationId);
    if (active === "true") query = query.is("end_date", null);

    const { data, error, count } = await query;
    if (error) return jsonError(error.message, 500);

    // Text search applied post-join on the small result set
    let rows = (data ?? []) as Array<{
      youth?: { full_name?: string; cdm_id?: string } | null;
      role_type?: { name?: string } | null;
      deanery?: { name?: string } | null;
      parish?: { name?: string } | null;
      outstation?: { name?: string } | null;
    }>;

    if (q) {
      const lower = q.toLowerCase();
      rows = rows.filter((r) => {
        const hay = [
          r.youth?.full_name,
          r.youth?.cdm_id,
          r.role_type?.name,
          r.deanery?.name,
          r.parish?.name,
          r.outstation?.name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(lower);
      });
    }

    return jsonOk({ data: rows, total: count ?? 0, page, size });
  },
});
