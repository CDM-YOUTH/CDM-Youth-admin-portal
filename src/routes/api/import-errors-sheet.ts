import { createAPIFileRoute } from "@tanstack/react-start/api";
import { google } from "googleapis";
import { guardRequest, jsonOk, jsonError } from "@/lib/api/server-client";
import type { ImportRowError } from "@/lib/db/youth-records/import";

const TAB = "Import Errors";

const HEADERS = [
  "Row #", "Full Name", "Gender", "Age", "Phone", "Alt Phone", "Email",
  "Deanery", "Parish", "Outstation", "Category", "Institution",
  "Year of Study", "Course", "Notes",
  "Diocese (Role)", "Deanery (Role)", "Parish (Role)", "Outstation (Role)",
  "Error Message",
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

async function ensureTab(sheets: ReturnType<typeof getSheets>, spreadsheetId: string): Promise<void> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = meta.data.sheets?.some((s) => s.properties?.title === TAB);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: TAB } } }],
      },
    });
  }
}

async function ensureHeaders(sheets: ReturnType<typeof getSheets>, spreadsheetId: string): Promise<void> {
  const check = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${TAB}'!A1:A1`,
  });
  if (!check.data.values?.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${TAB}'!A1:T1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [HEADERS] },
    });
  }
}

export const APIRoute = createAPIFileRoute("/api/import-errors-sheet")({
  POST: async ({ request }) => {
    const guard = await guardRequest(request);
    if ("error" in guard) return guard.error;

    let body: { errors?: ImportRowError[] };
    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid JSON body", 400);
    }

    const errors = body.errors ?? [];
    if (errors.length === 0) return jsonOk({ ok: true, logged: 0 });

    try {
      const sheets = getSheets();
      const spreadsheetId = getSheetId();

      await ensureTab(sheets, spreadsheetId);
      await ensureHeaders(sheets, spreadsheetId);

      const rows = errors.map((e) => {
        const d = e.data;
        return [
          e.row,
          d?.fullName ?? "",
          d?.gender ?? "",
          d?.age ?? "",
          d?.phone ?? "",
          d?.altPhone ?? "",
          d?.email ?? "",
          d?.deanery ?? "",
          d?.parish ?? "",
          d?.outstation ?? "",
          d?.category ?? "",
          d?.institution ?? "",
          d?.yearOfStudy ?? "",
          d?.course ?? "",
          d?.notes ?? "",
          d?.Diocese ?? "",
          d?.Deanery ?? "",
          d?.Parish ?? "",
          d?.Outstation ?? "",
          e.reason,
        ];
      });

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `'${TAB}'!A:T`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: rows },
      });

      return jsonOk({ ok: true, logged: rows.length });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Sheet write failed";
      console.error("[import-errors-sheet] error:", e);
      return jsonError(msg, 500);
    }
  },
});
