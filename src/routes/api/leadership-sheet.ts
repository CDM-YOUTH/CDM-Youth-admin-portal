import { createAPIFileRoute } from "@tanstack/react-start/api";
import { google } from "googleapis";
import { guardRequest, createServerClient, jsonOk, jsonError } from "@/lib/api/server-client";

const WORKSHOP_EVENT_ID = "391508e3-b057-48ef-aad0-2992046a91ff";

const HEADERS = [
  "CDM No.", "Full Name", "Gender", "Age", "Phone",
  "Deanery", "Parish", "Category", "Registered At",
  "Payment Method", "Amount", "Payment Confirmation", "Remarks",
];

function getSheets() {
  const b64 = process.env.GOOGLE_SA_KEY_BASE64;
  if (!b64) throw new Error("GOOGLE_SA_KEY_BASE64 not set");
  const key = JSON.parse(Buffer.from(b64, "base64").toString("utf-8")) as {
    client_email: string;
    private_key: string;
  };
  const auth = new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

function getSheetId() {
  const id = process.env.GOOGLE_SHEETS_ID;
  if (!id) throw new Error("GOOGLE_SHEETS_ID not set");
  return id;
}

async function ensureHeaders(sheets: ReturnType<typeof getSheets>, spreadsheetId: string) {
  const check = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Sheet1!A1:A1",
  });
  if (!check.data.values?.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "Sheet1!A1:M1",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [HEADERS] },
    });
  }
}

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

function toSheetRow(reg: RegRow): (string | number)[] {
  const t = new Date(reg.created_at).toLocaleString("en-KE", {
    timeZone: "Africa/Nairobi",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  if (reg.youth) {
    const y = reg.youth;
    return [
      y.cdm_id ?? "—",
      y.full_name,
      y.gender ?? "",
      y.age ?? "",
      y.phone ?? "",
      y.deanery?.name ?? "",
      y.parish?.name ?? "",
      y.category ?? "",
      t,
      "", "", "", "", // Payment Method | Amount | Payment Confirmation | Remarks (manual)
    ];
  }
  // Guest
  return [
    "—", reg.guest_name ?? "Walk-in Guest", "", "",
    reg.guest_phone ?? "", "", "", "", t,
    "", "", "", "Guest / Walk-in",
  ];
}

export const APIRoute = createAPIFileRoute("/api/leadership-sheet")({
  /* ── GET: bulk sync — fetch ALL registrations and rewrite sheet ── */
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

      const sheets = getSheets();
      const spreadsheetId = getSheetId();

      await ensureHeaders(sheets, spreadsheetId);

      // Clear existing data rows (preserve header + any payment columns filled manually)
      // We only clear columns A–I (system data). J–M (payment cols) are left untouched.
      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: "Sheet1!A2:I1000",
      });

      const rows = ((regs ?? []) as RegRow[]).map(toSheetRow);

      if (rows.length > 0) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `Sheet1!A2:M${rows.length + 1}`,
          valueInputOption: "USER_ENTERED",
          requestBody: { values: rows },
        });
      }

      return jsonOk({ ok: true, synced: rows.length });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Sync failed";
      console.error("[leadership-sheet] bulk sync error:", e);
      return jsonError(msg, 500);
    }
  },

  /* ── POST: single-row append — called after each registration ── */
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
          "", "", "", checkinTime,
          "", "", "", "Guest / Walk-in",
        ];
      }

      const sheets = getSheets();
      const spreadsheetId = getSheetId();
      await ensureHeaders(sheets, spreadsheetId);

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: "Sheet1!A:M",
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [values] },
      });

      return jsonOk({ ok: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Sheets sync failed";
      console.error("[leadership-sheet] append error:", e);
      return jsonError(msg, 500);
    }
  },
});
