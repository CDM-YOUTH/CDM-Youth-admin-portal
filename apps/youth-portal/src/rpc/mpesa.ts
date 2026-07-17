import { createServerFn } from "@tanstack/react-start";

// Safaricom Daraja STK Push. Credentials aren't configured yet (see
// apps/youth-portal/.env.local) — until they are, this logs the request
// server-side and returns `simulated: true` so the enrollment/merch flows
// stay testable end-to-end. The record itself is created client-side with
// status "pending", matching the admin portal's existing manual-confirmation
// workflow — a real deployment would flip it to "paid" via Daraja's
// callback webhook (not yet built) or an admin marking it paid by hand.
async function getDarajaAccessToken() {
  const key = process.env.DARAJA_CONSUMER_KEY;
  const secret = process.env.DARAJA_CONSUMER_SECRET;
  if (!key || !secret) return null;

  const auth = Buffer.from(`${key}:${secret}`).toString("base64");
  const res = await fetch("https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials", {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) throw new Error(`Daraja auth failed: ${res.status}`);
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

export const initiateStkPush = createServerFn({ method: "POST" })
  .inputValidator((input: { phone: string; amount: number; accountRef: string; description: string }) => input)
  .handler(async ({ data }) => {
    const shortcode = process.env.DARAJA_SHORTCODE;
    const passkey = process.env.DARAJA_PASSKEY;
    const token = await getDarajaAccessToken();

    if (!token || !shortcode || !passkey) {
      console.warn(
        `[mpesa:stub] would initiate STK push for ${data.phone}, Ksh ${data.amount}, ref ${data.accountRef}: ${data.description}`,
      );
      return { simulated: true, checkoutRequestId: null };
    }

    const timestamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");

    const res = await fetch("https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: data.amount,
        PartyA: data.phone.replace("+", ""),
        PartyB: shortcode,
        PhoneNumber: data.phone.replace("+", ""),
        CallBackURL: "https://example.com/mpesa/callback",
        AccountReference: data.accountRef,
        TransactionDesc: data.description,
      }),
    });

    if (!res.ok) throw new Error(`Daraja STK push failed: ${res.status} ${await res.text()}`);
    const json = (await res.json()) as { CheckoutRequestID: string };
    return { simulated: false, checkoutRequestId: json.CheckoutRequestID };
  });
