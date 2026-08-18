import { createFileRoute } from "@tanstack/react-router";
import {
  guardRequest,
  createServerClient,
  parsePagination,
  jsonOk,
  jsonError,
  applyCallerScope,
} from "@/lib/api/server-client";

export const Route = createFileRoute("/api/enrollments")({
  server: {
    handlers: {
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

        // Enforce caller's assigned scope — a scoped user cannot query outside their org.
        const { deaneryId, parishId, outstationId } = applyCallerScope(
          {
            deaneryId: url.searchParams.get("deanery_id"),
            parishId: url.searchParams.get("parish_id"),
            outstationId: url.searchParams.get("outstation_id"),
          },
          guard,
        );

        const db = createServerClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let query = (db as any)
          .from("enrollments")
          .select(
            "*, youth:youths(cdm_id, full_name, category, deanery_id, parish_id, outstation_id, deanery:deaneries(name), parish:parishes(name))",
            { count: "exact" },
          )
          .order("created_at", { ascending: false })
          .range(page * size, page * size + size - 1);

        if (year) query = query.eq("year", year);
        if (status) query = query.eq("status", status);

        const { data, error, count } = await query;
        if (error) return jsonError(error.message, 500);

        type YouthJoin = {
          cdm_id?: string;
          full_name?: string;
          deanery_id?: string | null;
          parish_id?: string | null;
          outstation_id?: string | null;
          deanery?: { name?: string } | null;
          parish?: { name?: string } | null;
        };

        let rows = (data ?? []) as Array<{ youth?: YouthJoin | null }>;

        // Enforce org scope: filter by the youth's org IDs (included in the select above).
        if (deaneryId || parishId || outstationId) {
          rows = rows.filter((r) => {
            const y = r.youth;
            if (outstationId) return y?.outstation_id === outstationId;
            if (parishId) return y?.parish_id === parishId;
            if (deaneryId) return y?.deanery_id === deaneryId;
            return true;
          });
        }

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
    },
  },
});
