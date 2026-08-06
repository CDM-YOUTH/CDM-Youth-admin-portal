/**
 * Runs a SQL file against the Supabase project using the Management API.
 * Requires a personal access token from https://supabase.com/dashboard/account/tokens
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/apply-migration.mjs <file.sql>
 */

import { readFileSync } from "fs";

const PROJECT_REF  = "linthhfiydxukbhjgfcz";
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!ACCESS_TOKEN) {
  console.error(
    "Missing SUPABASE_ACCESS_TOKEN.\n" +
    "Get one from: https://supabase.com/dashboard/account/tokens\n" +
    "Then run:\n  SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/apply-migration.mjs <file.sql>"
  );
  process.exit(1);
}

const sqlFile = process.argv[2];
if (!sqlFile) { console.error("Usage: node scripts/apply-migration.mjs <file.sql>"); process.exit(1); }

const query = readFileSync(sqlFile, "utf8");

const res = await fetch(
  `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  }
);

const body = await res.text();
if (!res.ok) {
  console.error(`Error ${res.status}:`, body);
  process.exit(1);
}
console.log("Migration applied successfully.");
console.log(body);
