import { google } from "googleapis";

const HEADERS = [
  "CDM No.", "Full Name", "Gender", "Age", "Phone",
  "Deanery", "Parish", "Category", "Check-in Time",
];

export type LeadershipSheetRow = {
  cdmId: string | null;
  fullName: string;
  gender: string | null;
  age: number | null;
  phone: string | null;
  deanery: string | null;
  parish: string | null;
  category: string | null;
  checkinTime: string;
};

function getAuth() {
  const b64 = process.env.GOOGLE_SA_KEY_BASE64;
  if (!b64) throw new Error("GOOGLE_SA_KEY_BASE64 env var is not set");
  const key = JSON.parse(Buffer.from(b64, "base64").toString("utf-8")) as {
    client_email: string;
    private_key: string;
  };
  return new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function getSheetId() {
  const id = process.env.GOOGLE_SHEETS_ID;
  if (!id) throw new Error("GOOGLE_SHEETS_ID env var is not set");
  return id;
}

export async function appendLeadershipWorkshopRow(row: LeadershipSheetRow): Promise<void> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = getSheetId();

  // Add header row if the sheet is empty
  const check = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Sheet1!A1:A1",
  });
  if (!check.data.values?.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "Sheet1!A1:I1",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [HEADERS] },
    });
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "Sheet1!A:I",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        row.cdmId ?? "—",
        row.fullName,
        row.gender ?? "",
        row.age ?? "",
        row.phone ?? "",
        row.deanery ?? "",
        row.parish ?? "",
        row.category ?? "",
        row.checkinTime,
      ]],
    },
  });
}
