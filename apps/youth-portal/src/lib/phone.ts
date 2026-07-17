// Kenyan phone number helpers. The portal always talks to Supabase Auth in
// E.164 (+254…); the UI accepts the common local formats too.
export function looksLikeCdmId(input: string) {
  return /^cdm-/i.test(input.trim());
}

export function normalizeKenyanPhone(input: string): string | null {
  const digits = input.trim().replace(/[^\d+]/g, "");
  if (/^\+254\d{9}$/.test(digits)) return digits;
  if (/^254\d{9}$/.test(digits)) return `+${digits}`;
  if (/^0\d{9}$/.test(digits)) return `+254${digits.slice(1)}`;
  if (/^7\d{8}$/.test(digits) || /^1\d{8}$/.test(digits)) return `+254${digits}`;
  return null;
}
