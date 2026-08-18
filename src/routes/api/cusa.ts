import { createFileRoute } from "@tanstack/react-router";
import {
  guardRequest,
  createServerClient,
  parsePagination,
  jsonOk,
  jsonError,
  applyCallerScope,
} from "@/lib/api/server-client";
import { likePattern } from "@/lib/utils";

export const Route = createFileRoute("/api/cusa")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const guard = await guardRequest(request);
        if ("error" in guard) return guard.error;

        const url = new URL(request.url);
        const { page, size } = parsePagination(url);
        const q = url.searchParams.get("q")?.trim() ?? "";
        const year = parseInt(url.searchParams.get("year") ?? String(new Date().getFullYear()), 10);
        const institution = url.searchParams.get("institution")?.trim() ?? "";

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
          .from("cusa_members")
          .select(
            "*, youth:youths(cdm_id, full_name, gender, deanery_id, parish_id, outstation_id, deanery:deaneries(name), parish:parishes(name), outstation:outstations(name))",
            { count: "exact" },
          )
          .eq("year", year)
          .order("created_at", { ascending: false })
          .range(page * size, page * size + size - 1);

        if (institution) query = query.ilike("institution", likePattern(institution));
        if (q) {
          const term = likePattern(q);
          query = query.or(`institution.ilike.${term},course.ilike.${term}`);
        }

        const { data, error, count } = await query;
        if (error) return jsonError(error.message, 500);

        type YouthJoin = {
          cdm_id?: string;
          full_name?: string;
          gender?: string;
          deanery_id?: string | null;
          parish_id?: string | null;
          outstation_id?: string | null;
          deanery?: { name: string } | null;
          parish?: { name: string } | null;
          outstation?: { name: string } | null;
        };

        let rows = (data ?? []) as Array<{ youth?: YouthJoin | null }>;

        if (q && !institution) {
          const lower = q.toLowerCase();
          rows = rows.filter((r) => {
            const y = r.youth;
            return (
              y?.cdm_id?.toLowerCase().includes(lower) ||
              y?.full_name?.toLowerCase().includes(lower)
            );
          });
        }

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

        return jsonOk({ data: rows, total: count ?? 0, page, size });
      },
    },
  },
});
