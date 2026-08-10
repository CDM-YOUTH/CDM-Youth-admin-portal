/**
 * Google Sheets API v4 helper using native fetch + Web Crypto API.
 * Works in Cloudflare Workers, Node.js, and any Web-standard environment.
 * Does NOT depend on `googleapis` (Node.js-only package).
 */

export type ServiceAccountKey = {
  client_email: string;
  private_key: string;
};

export function getServiceAccountKey(): ServiceAccountKey {
  const b64 = process.env.GOOGLE_SA_KEY_BASE64;
  if (!b64) throw new Error("GOOGLE_SA_KEY_BASE64 not set");
  // atob is available everywhere; Buffer.from is a fallback for older Node
  const json =
    typeof atob !== "undefined"
      ? atob(b64)
      : Buffer.from(b64, "base64").toString("utf-8");
  return JSON.parse(json) as ServiceAccountKey;
}

export function getSpreadsheetId(): string {
  const id = process.env.GOOGLE_SHEETS_ID;
  if (!id) throw new Error("GOOGLE_SHEETS_ID not set");
  return id;
}

// ── JWT helpers ──────────────────────────────────────────────────────────────

function toBase64Url(input: string | Uint8Array): string {
  let binary: string;
  if (typeof input === "string") {
    binary = input;
  } else {
    binary = "";
    for (let i = 0; i < input.length; i++) binary += String.fromCharCode(input[i]);
  }
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function jsonToBase64Url(obj: unknown): string {
  return toBase64Url(JSON.stringify(obj));
}

async function rsaSign(pem: string, data: string): Promise<Uint8Array> {
  const pemBody = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const keyBytes = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(data),
  );
  return new Uint8Array(sig);
}

// ── OAuth2 token exchange ────────────────────────────────────────────────────

export async function getGoogleAccessToken(key: ServiceAccountKey): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = jsonToBase64Url({ alg: "RS256", typ: "JWT" });
  const payload = jsonToBase64Url({
    iss: key.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  });
  const signingInput = `${header}.${payload}`;
  const sig = await rsaSign(key.private_key, signingInput);
  const jwt = `${signingInput}.${toBase64Url(sig)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token exchange failed: ${text}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

// ── Sheets REST helpers ──────────────────────────────────────────────────────

const BASE = "https://sheets.googleapis.com/v4/spreadsheets";

function ah(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export async function sheetsGetValues(
  token: string,
  spreadsheetId: string,
  range: string,
): Promise<{ values?: (string | number)[][] }> {
  const res = await fetch(`${BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}`, {
    headers: ah(token),
  });
  return res.json() as Promise<{ values?: (string | number)[][] }>;
}

export async function sheetsUpdateValues(
  token: string,
  spreadsheetId: string,
  range: string,
  values: (string | number | null)[][],
): Promise<void> {
  const res = await fetch(
    `${BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: ah(token),
      body: JSON.stringify({ range, majorDimension: "ROWS", values }),
    },
  );
  if (!res.ok) throw new Error(`Sheets update failed: ${await res.text()}`);
}

export async function sheetsAppendValues(
  token: string,
  spreadsheetId: string,
  range: string,
  values: (string | number | null)[][],
): Promise<void> {
  const res = await fetch(
    `${BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`,
    {
      method: "POST",
      headers: ah(token),
      body: JSON.stringify({ majorDimension: "ROWS", values }),
    },
  );
  if (!res.ok) throw new Error(`Sheets append failed: ${await res.text()}`);
}

export async function sheetsClearValues(
  token: string,
  spreadsheetId: string,
  range: string,
): Promise<void> {
  const res = await fetch(
    `${BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}:clear`,
    { method: "POST", headers: ah(token) },
  );
  if (!res.ok) throw new Error(`Sheets clear failed: ${await res.text()}`);
}

export async function sheetsGetMetadata(
  token: string,
  spreadsheetId: string,
): Promise<{ sheets?: { properties?: { title?: string; sheetId?: number } }[] }> {
  const res = await fetch(`${BASE}/${spreadsheetId}`, { headers: ah(token) });
  return res.json() as Promise<{
    sheets?: { properties?: { title?: string; sheetId?: number } }[];
  }>;
}

export async function sheetsBatchUpdate(
  token: string,
  spreadsheetId: string,
  requests: unknown[],
): Promise<void> {
  const res = await fetch(`${BASE}/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    headers: ah(token),
    body: JSON.stringify({ requests }),
  });
  if (!res.ok) throw new Error(`Sheets batchUpdate failed: ${await res.text()}`);
}
