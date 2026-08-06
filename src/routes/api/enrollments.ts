import { createAPIFileRoute } from "@tanstack/react-start/api";
import { guardRequest, createServerClient, parsePagination, jsonOk, jsonError } from "@/lib/api/server-client";

export const APIRoute = createAPIFileRoute("/api/enrollments")({
  GET: async ({ request }) => {
    const guard = await guardRequest(request);
    if ("error" in guard) return guard.error;

    const url = new URL(request.url);
    const { page, size } = parsePagination(url);
    const q = url.searchParams.get("q")?.trim() ?? "";
    const year = url.searchParams.get("year")
      ? parseInt(url.searchParams.get("year")!, 10)
      : null;
    const status = url.searchParams.get("status");

    const db = createServerClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (db as any)
      .from("enrollments")
      .select(
        "*, youth:youths(cdm_id, full_name, category, deanery:deaneries(name), parish:parishes(name))",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(page * size, page * size + size - 1);

    if (year) query = query.eq("year", year);
    if (status) query = query.eq("status", status);

    const { data, error, count } = await query;
    if (error) return jsonError(error.message, 500);

    let rows = (data ?? []) as Array<{
      youth?: { cdm_id?: string; full_name?: string; deanery?: { name?: string } | null; parish?: { name?: string } | null } | null;
    }>;

    if (q) {
      const lower = q.toLowerCase();
      rows = rows.filter((r) => {
        const hay = [
          r.youth?.cdm_id,
          r.youth?.full_name,
          r.youth?.deanery?.name,
          r.youth?.parish?.name,
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
