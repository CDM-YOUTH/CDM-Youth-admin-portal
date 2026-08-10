import { createAPIFileRoute } from "@tanstack/react-start/api";
import { guardRequest, createServerClient, jsonOk, jsonError } from "@/lib/api/server-client";
import {
  getServiceAccountKey,
  getSpreadsheetId,
  getGoogleAccessToken,
  sheetsGetValues,
  sheetsUpdateValues,
  sheetsAppendValues,
  sheetsClearValues,
} from "@/lib/google/sheets-fetch";

const WORKSHOP_EVENT_ID = "391508e3-b057-48ef-aad0-2992046a91ff";

const HEADERS = [
  "CDM No.", "Full Name", "Gender", "Age", "Phone",
  "Deanery", "Parish", "Category", "Registered At",
  "Payment Method", "Amount", "Payment Confirmation", "Remarks",
];

type RegRow = {
  created_at: string;
  guest_name: string | null;
  guest_phone: string | null;
  youth: {
    cdm_id: string | null;
    full_name: string;
    gender: string | null;
    age: number | null;
    phone: string | null;
    category: string | null;
    deanery: { name: string } | null;
    parish: { name: string } | null;
  } | null;
};

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString("en-KE", {
    timeZone: "Africa/Nairobi",
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

function toSheetRow(reg: RegRow): (string | number)[] {
  if (reg.youth) {
    const y = reg.youth;
    return [
      y.cdm_id ?? "—", y.full_name, y.gender ?? "", y.age ?? "",
      y.phone ?? "", y.deanery?.name ?? "", y.parish?.name ?? "",
      y.category ?? "", fmtTime(reg.created_at),
      "", "", "", "",
    ];
  }
  return [
    "—", reg.guest_name ?? "Walk-in Guest", "", "",
    reg.guest_phone ?? "", "", "", "", fmtTime(reg.created_at),
    "", "", "", "Guest / Walk-in",
  ];
}

async function ensureHeaders(token: string, spreadsheetId: string) {
  const check = await sheetsGetValues(token, spreadsheetId, "Sheet1!A1:A1");
  if (!check.values?.length) {
    await sheetsUpdateValues(token, spreadsheetId, "Sheet1!A1:M1", [HEADERS]);
  }
}

export const APIRoute = createAPIFileRoute("/api/leadership-sheet")({
  /* ── GET: bulk sync ────────────────────────────────────────────────────── */
  GET: async ({ request }) => {
    const guard = await guardRequest(request);
    if ("error" in guard) return guard.error;

    try {
      const db = createServerClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: regs, error } = await (db as any)
        .from("event_registrations")
        .select(
          "created_at, guest_name, guest_phone, youth:youths(cdm_id, full_name, gender, age, phone, category, deanery:deaneries(name), parish:parishes(name))",
        )
        .eq("event_id", WORKSHOP_EVENT_ID)
        .order("created_at", { ascending: true });

      if (error) return jsonError(error.message, 500);

      const key = getServiceAccountKey();
      const token = await getGoogleAccessToken(key);
      const spreadsheetId = getSpreadsheetId();

      await ensureHeaders(token, spreadsheetId);
      await sheetsClearValues(token, spreadsheetId, "Sheet1!A2:I1000");

      const rows = ((regs ?? []) as RegRow[]).map(toSheetRow);
      if (rows.length > 0) {
        await sheetsUpdateValues(token, spreadsheetId, `Sheet1!A2:M${rows.length + 1}`, rows);
      }

      return jsonOk({ ok: true, synced: rows.length });
    } catch (e: unknown) {
      console.error("[leadership-sheet] sync error:", e);
      return jsonError(e instanceof Error ? e.message : "Sync failed", 500);
    }
  },

  /* ── POST: single append after registration ────────────────────────────── */
  POST: async ({ request }) => {
    const guard = await guardRequest(request);
    if ("error" in guard) return guard.error;

    let body: { eventId?: string; cdmId?: string | null; guestName?: string | null; guestPhone?: string | null };
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON body", 400);
    }

    if (body.eventId !== WORKSHOP_EVENT_ID) return jsonOk({ skipped: true });

    const checkinTime = new Date().toLocaleString("en-KE", {
      timeZone: "Africa/Nairobi",
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: false,
    });

    try {
      let values: (string | number)[];

      if (body.cdmId) {
        const db = createServerClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: youth, error } = await (db as any)
          .from("youths")
          .select("full_name, gender, age, phone, category, deanery:deaneries(name), parish:parishes(name)")
          .eq("cdm_id", body.cdmId.trim().toUpperCase())
          .maybeSingle();

        if (error) return jsonError(error.message, 500);
        if (!youth) return jsonError(`Youth not found: ${body.cdmId}`, 404);

        const y = youth as {
          full_name: string; gender: string | null; age: number | null;
          phone: string | null; category: string | null;
          deanery: { name: string } | null; parish: { name: string } | null;
        };
        values = [
          body.cdmId, y.full_name, y.gender ?? "", y.age ?? "", y.phone ?? "",
          y.deanery?.name ?? "", y.parish?.name ?? "", y.category ?? "", checkinTime,
          "", "", "", "",
        ];
      } else {
        values = [
          "—", body.guestName ?? "Walk-in Guest", "", "", body.guestPhone ?? "",
          "", "", "", checkinTime, "", "", "", "Guest / Walk-in",
        ];
      }

      const key = getServiceAccountKey();
      const token = await getGoogleAccessToken(key);
      const spreadsheetId = getSpreadsheetId();

      await ensureHeaders(token, spreadsheetId);
      await sheetsAppendValues(token, spreadsheetId, "Sheet1!A:M", [values]);

      return jsonOk({ ok: true });
    } catch (e: unknown) {
      console.error("[leadership-sheet] append error:", e);
      return jsonError(e instanceof Error ? e.message : "Sheets sync failed", 500);
    }
  },
});
