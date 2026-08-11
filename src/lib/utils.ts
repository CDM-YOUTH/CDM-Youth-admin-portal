import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Build a safe ILIKE wildcard pattern for PostgREST `.or()` / `.ilike()` calls.
 * Escapes PostgreSQL LIKE wildcards (%, _) in the user-supplied portion and
 * strips characters that would break PostgREST's filter-string parser (, ( )).
 */
/** Capitalize each word for display — normalises ALL CAPS, all-lowercase, and
 *  Unicode bold/italic math characters (common from Excel/Word copy-paste). */
export function titleCase(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .trim()
    .normalize("NFKC")   // 𝐅𝐞𝐥𝐢𝐬𝐭𝐚 → Felista, 𝑴𝒖𝒓𝒊𝒊𝒕𝒉𝒊 → Muriithi
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Format a phone number for display.
 * Strips leading 0 and prepends +254 if not already an international number.
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const s = phone.trim();
  if (!s) return "";
  if (s.startsWith("+")) return s;          // already international
  if (s.startsWith("254")) return `+${s}`; // missing leading +
  if (s.startsWith("0")) return `+254${s.slice(1)}`; // local format
  return `+254${s}`;                        // bare 9-digit
}

export function likePattern(raw: string): string {
  const clean = raw
    .trim()
    .replace(/[\\%_]/g, "\\$&")  // escape LIKE special chars
    .replace(/[,()]/g, " ")       // neutralise PostgREST filter separators
    .trim();
  return `%${clean}%`;
}
