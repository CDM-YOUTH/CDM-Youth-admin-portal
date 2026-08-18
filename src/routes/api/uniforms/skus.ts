import { createFileRoute } from "@tanstack/react-router";
import {
  guardRequest,
  createServerClient,
  jsonOk,
  jsonError,
  isStaff,
} from "@/lib/api/server-client";
import { likePattern } from "@/lib/utils";

export const Route = createFileRoute("/api/uniforms/skus")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const guard = await guardRequest(request);
        if ("error" in guard) return guard.error;
        if (!isStaff(guard.role)) return jsonError("Forbidden", 403);

        const url = new URL(request.url);
        const q = url.searchParams.get("q")?.trim() ?? "";

        const db = createServerClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let query = (db as any).from("uniform_skus").select("*").order("name");

        if (q) query = query.ilike("name", likePattern(q));

        const { data, error } = await query;
        if (error) return jsonError(error.message, 500);

        return jsonOk({ data: data ?? [], total: (data ?? []).length });
      },
    },
  },
});
