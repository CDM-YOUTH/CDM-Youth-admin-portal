import { createAPIFileRoute } from "@tanstack/react-start/api";
import { guardRequest, createServerClient, jsonOk, jsonError } from "@/lib/api/server-client";

export const APIRoute = createAPIFileRoute("/api/uniforms/skus")({
  GET: async ({ request }) => {
    const guard = await guardRequest(request);
    if ("error" in guard) return guard.error;

    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim() ?? "";

    const db = createServerClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (db as any).from("uniform_skus").select("*").order("name");

    if (q) query = query.ilike("name", `%${q}%`);

    const { data, error } = await query;
    if (error) return jsonError(error.message, 500);

    return jsonOk({ data: data ?? [], total: (data ?? []).length });
  },
});
