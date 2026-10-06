import { createFileRoute } from "@tanstack/react-router";
import { getProjectsSummary } from "@/lib/db/finances";
import { jsonOk, jsonError } from "@/lib/api/server-client";

export const Route = createFileRoute("/api/finances/projects-summary")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const year = parseInt(
            url.searchParams.get("year") || new Date().getFullYear().toString(),
          );
          const deaneryId = url.searchParams.get("deaneryId") || null;
          const parishId = url.searchParams.get("parishId") || null;

          const summary = await getProjectsSummary({ year, deaneryId, parishId });
          return jsonOk(summary);
        } catch (error: any) {
          return jsonError(error.message || "Failed to fetch projects summary", 500);
        }
      },
    },
  },
});
