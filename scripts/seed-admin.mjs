/**

 * Creates the CDM Office admin account via the Supabase Admin API.
 *
 * Usage:
 *   node scripts/seed-admin.mjs <SERVICE_ROLE_KEY>
 *
 * Get your service role key from:
 *   Supabase Dashboard → Project Settings → API → service_role (secret)
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://otatghgorvqmankxnzrf.supabase.co";
const SERVICE_KEY = process.argv[2];

if (!SERVICE_KEY) {
  console.error("Error: service role key required.\n");
  console.error("Usage: node scripts/seed-admin.mjs <SERVICE_ROLE_KEY>\n");
  console.error("Find it at: Supabase Dashboard → Project Settings → API → service_role");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  console.log("Creating CDM Office admin account...\n");

  // ---- 1. Create (or find) the auth user ----
  let uid;

  const { data: created, error: createError } =
    await supabase.auth.admin.createUser({
      email: "cdmoffice@diocese.ke",
      password: "office123",
      email_confirm: true,
      user_metadata: { full_name: "CDM Office" },
    });

  if (createError) {
    if (
      createError.message.toLowerCase().includes("already") ||
      createError.message.toLowerCase().includes("registered")
    ) {
      // User exists — look them up
      console.log("User already exists, looking up existing account...");
      const { data: list, error: listError } =
        await supabase.auth.admin.listUsers({ perPage: 1000 });
      if (listError) throw listError;

      const existing = list.users.find(
        (u) => u.email === "cdmoffice@diocese.ke"
      );
      if (!existing) {
        throw new Error(
          "Could not find existing user — check your dashboard manually."
        );
      }
      uid = existing.id;
      console.log("Found existing user:", uid);

      // Update password in case it drifted
      const { error: pwErr } = await supabase.auth.admin.updateUserById(uid, {
        password: "office123",
        email_confirm: true,
      });
      if (pwErr) throw pwErr;
      console.log("Password reset to office123");
    } else {
      throw createError;
    }
  } else {
    uid = created.user.id;
    console.log("Auth user created:", uid);
  }

  // ---- 2. Profile ----
  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: uid,
      full_name: "CDM Office",
      position: "Diocese Youth Coordinator",
    },
    { onConflict: "id" }
  );
  if (profileError) throw profileError;
  console.log("Profile saved");

  // ---- 3. Admin role ----
  const { error: roleError } = await supabase
    .from("user_roles")
    .upsert({ user_id: uid, role: "office" }, { onConflict: "user_id,role" });
  if (roleError) throw roleError;
  console.log("Office role assigned");

  console.log("\n✓ All done! Login credentials:");
  console.log("   Email:    cdmoffice@diocese.ke");
  console.log("   Password: office123");
}

main().catch((err) => {
  console.error("\nFailed:", err.message ?? err);
  process.exit(1);
});
