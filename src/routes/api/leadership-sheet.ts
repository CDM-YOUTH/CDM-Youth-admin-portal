import { createAPIFileRoute } from "@tanstack/react-start/api";
import { guardRequest, createServerClient, jsonOk, jsonError } from "@/lib/api/server-client";
import { appendLeadershipWorkshopRow } from "@/lib/google/sheets";

const WORKSHOP_EVENT_ID = "391508e3-b057-48ef-aad0-2992046a91ff";

export const APIRoute = createAPIFileRoute("/api/leadership-sheet")({
  POST: async ({ request }) => {
    const guard = await guardRequest(request);
    if ("error" in guard) return guard.error;

    let body: {
      eventId?: string;
      cdmId?: string | null;
      guestName?: string | null;
      guestPhone?: string | null;
    };
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON body", 400);
    }

    if (body.eventId !== WORKSHOP_EVENT_ID) {
      return jsonOk({ skipped: true });
    }

    const checkinTime = new Date().toLocaleString("en-KE", {
      timeZone: "Africa/Nairobi",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    try {
      let rowData: Parameters<typeof appendLeadershipWorkshopRow>[0];

      if (body.cdmId) {
        const db = createServerClient();
        const { data: youth, error } = await (db as ReturnType<typeof createServerClient>)
          .from("youths")
          .select("full_name, gender, age, phone, category, deanery:deaneries(name), parish:parishes(name)")
          .eq("cdm_id", body.cdmId.trim().toUpperCase())
          .maybeSingle();

        if (error) return jsonError(error.message, 500);
        if (!youth) return jsonError(`Youth not found: ${body.cdmId}`, 404);

        const y = youth as {
          full_name: string;
          gender: string | null;
          age: number | null;
          phone: string | null;
          category: string | null;
          deanery: { name: string } | null;
          parish: { name: string } | null;
        };

        rowData = {
          cdmId: body.cdmId,
          fullName: y.full_name,
          gender: y.gender,
          age: y.age,
          phone: y.phone,
          deanery: y.deanery?.name ?? null,
          parish: y.parish?.name ?? null,
          category: y.category,
          checkinTime,
        };
      } else {
        rowData = {
          cdmId: null,
          fullName: body.guestName ?? "Walk-in Guest",
          gender: null,
          age: null,
          phone: body.guestPhone ?? null,
          deanery: null,
          parish: null,
          category: null,
          checkinTime,
        };
      }

      await appendLeadershipWorkshopRow(rowData);
      return jsonOk({ ok: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Sheets sync failed";
      console.error("[leadership-sheet] sync error:", e);
      return jsonError(msg, 500);
    }
  },
});
