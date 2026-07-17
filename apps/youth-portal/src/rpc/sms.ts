// SMS delivery for OTP codes. Africa's Talking credentials aren't configured
// yet (see apps/youth-portal/.env) — until they are, this logs the message
// server-side so the forgot-password flow is still testable end-to-end.
export async function sendSms(phone: string, message: string) {
  const apiKey = process.env.AFRICASTALKING_API_KEY;
  const username = process.env.AFRICASTALKING_USERNAME;

  if (!apiKey || !username) {
    console.warn(`[sms:stub] would send to ${phone}: ${message}`);
    return;
  }

  const res = await fetch("https://api.africastalking.com/version1/messaging", {
    method: "POST",
    headers: {
      apiKey,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({ username, to: phone, message }),
  });

  if (!res.ok) {
    throw new Error(`Africa's Talking SMS send failed: ${res.status} ${await res.text()}`);
  }
}
