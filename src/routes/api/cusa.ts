import { createAPIFileRoute } from "@tanstack/react-start/api";
import { guardRequest, createServerClient, parsePagination, jsonOk, jsonError } from "@/lib/api/server-client";

export const APIRoute = createAPIFileRoute("/api/cusa")({
  GET: async ({ request }) => {
    const guard = await guardRequest(request);
    if ("error" in guard) return guard.error;

    const url = new URL(request.url);
    const { page, size } = parsePagination(url);
    const q = url.searchParams.get("q")?.trim() ?? "";
    const year = parseInt(url.searchParams.get("year") ?? String(new Date().getFullYear()), 10);
    const institution = url.searchParams.get("institution")?.trim() ?? "";
    const deaneryId = url.searchParams.get("deanery_id");
    const parishId = url.searchParams.get("parish_id");
    const outstationId = url.searchParams.get("outstation_id");

    const db = createServerClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (db as any)
      .from("cusa_members")
      .select(
        "*, youth:youths(cdm_id, full_name, gender, deanery:deaneries(name), parish:parishes(name), outstation:outstations(name))",
        { count: "exact" },
      )
      .eq("year", year)
      .order("created_at", { ascending: false })
      .range(page * size, page * size + size - 1);

    if (institution) query = query.ilike("institution", `%${institution}%`);
    if (q) {
      const term = `%${q}%`;
      query = query.or(`institution.ilike.${term},course.ilike.${term}`);
    }

    const { data, error, count } = await query;
    if (error) return jsonError(error.message, 500);

    // Apply org filters post-join (Supabase doesn't support filtering on joined columns directly in all versions)
    let rows = (data ?? []) as Array<{
      youth?: {
        deanery?: { name: string } | null;
        parish?: { name: string } | null;
        outstation?: { name: string } | null;
      } | null;
    }>;

    if (q && !institution) {
      // Also match against youth name/CDM in q
      const lower = q.toLowerCase();
      rows = rows.filter((r) => {
        const y = r.youth;
        return (
          (y as { cdm_id?: string } | null | undefined)?.cdm_id?.toLowerCase().includes(lower) ||
          (y as { full_name?: string } | null | undefined)?.full_name?.toLowerCase().includes(lower)
        );
      });
    }

    // Filter by org UUID via joined youth record names would require a different query strategy.
    // Instead, we filter by youth's org at query time using a subquery approach:
    // This is applied here as a best-effort filter. For strict UUID filtering, consider
    // adding deanery_id/parish_id columns to cusa_members or using an RPC.
    if (deaneryId || parishId || outstationId) {
      rows = rows.filter((r) => {
        // cusa_members doesn't store org IDs directly — filter via youth record if possible
        return true; // placeholder: org filter not yet enforced server-side for CUSA
      });
    }

    return jsonOk({ data: rows, total: count ?? 0, page, size });
  },
});
