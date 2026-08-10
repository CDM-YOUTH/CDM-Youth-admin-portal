import { createAPIFileRoute } from "@tanstack/react-start/api";
import { guardRequest, jsonOk, jsonError } from "@/lib/api/server-client";
import type { ImportRowError } from "@/lib/db/youth-records/import";
import {
  getServiceAccountKey,
  getSpreadsheetId,
  getGoogleAccessToken,
  sheetsGetValues,
  sheetsUpdateValues,
  sheetsAppendValues,
  sheetsGetMetadata,
  sheetsBatchUpdate,
} from "@/lib/google/sheets-fetch";

const TAB = "Import Errors";

const HEADERS = [
  "Row #", "Full Name", "Gender", "Age", "Phone", "Alt Phone", "Email",
  "Deanery", "Parish", "Outstation", "Category", "Institution",
  "Year of Study", "Course", "Notes",
  "Diocese (Role)", "Deanery (Role)", "Parish (Role)", "Outstation (Role)",
  "Error Message",
];

async function ensureTab(token: string, spreadsheetId: string): Promise<void> {
  const meta = await sheetsGetMetadata(token, spreadsheetId);
  const exists = meta.sheets?.some((s) => s.properties?.title === TAB);
  if (!exists) {
    await sheetsBatchUpdate(token, spreadsheetId, [
      { addSheet: { properties: { title: TAB } } },
    ]);
  }
}

async function ensureHeaders(token: string, spreadsheetId: string): Promise<void> {
  const check = await sheetsGetValues(token, spreadsheetId, `'${TAB}'!A1:A1`);
  if (!check.values?.length) {
    await sheetsUpdateValues(token, spreadsheetId, `'${TAB}'!A1:T1`, [HEADERS]);
  }
}

export const APIRoute = createAPIFileRoute("/api/sheets/errors")({
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
      const key = getServiceAccountKey();
      const token = await getGoogleAccessToken(key);
      const spreadsheetId = getSpreadsheetId();

      await ensureTab(token, spreadsheetId);
      await ensureHeaders(token, spreadsheetId);

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

      await sheetsAppendValues(token, spreadsheetId, `'${TAB}'!A:T`, rows);

      return jsonOk({ ok: true, logged: rows.length });
    } catch (e: unknown) {
      console.error("[sheets/errors] error:", e);
      return jsonError(e instanceof Error ? e.message : "Sheet write failed", 500);
    }
  },
});
