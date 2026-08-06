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
export function likePattern(raw: string): string {
  const clean = raw
    .trim()
    .replace(/[\\%_]/g, "\\$&")  // escape LIKE special chars
    .replace(/[,()]/g, " ")       // neutralise PostgREST filter separators
    .trim();
  return `%${clean}%`;
}
