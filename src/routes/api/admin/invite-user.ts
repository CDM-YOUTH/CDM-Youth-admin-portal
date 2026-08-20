import { createFileRoute } from "@tanstack/react-router";
import { guardRequest, jsonOk, jsonError } from "@/lib/api/server-client";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type InviteBody = {
  email?: string;
  fullName?: string;
  role?: string;
  deaneryId?: string | null;
  parishId?: string | null;
  outstationId?: string | null;
};

export const Route = createFileRoute("/api/admin/invite-user")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const guard = await guardRequest(request);
        if ("error" in guard) return guard.error;

        try {
          // Who can invite is itself configurable via the Roles tab (role_permissions'
          // can_create flag on the "users" module) rather than hardcoded — matches
          // today's behavior by default, since only admin/office have that set.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: invitePerm } = await (supabaseAdmin as any)
            .from("role_permissions")
            .select("can_create")
            .eq("role", guard.role)
            .eq("module", "users")
            .maybeSingle();
          if (!invitePerm?.can_create) return jsonError("Forbidden", 403);

          let body: InviteBody;
          try {
            body = await request.json();
          } catch {
            return jsonError("Invalid request body", 400);
          }

          const email = body.email?.trim().toLowerCase() ?? "";
          const fullName = body.fullName?.trim() ?? "";
          const role = body.role ?? "";
          if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return jsonError("A valid email is required", 400);
          }
          if (!fullName) return jsonError("Full name is required", 400);

          const { data: roleRow } = await supabaseAdmin
            .from("roles")
            .select("name")
            .eq("name", role)
            .maybeSingle();
          if (!roleRow) return jsonError("Invalid role", 400);

          const origin = process.env.SITE_URL ?? new URL(request.url).origin;
          const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
            data: { full_name: fullName },
            redirectTo: `${origin}/set-password`,
          });
          if (error || !data?.user) {
            return jsonError(error?.message ?? "Failed to send invite", 400);
          }

          const userId = data.user.id;

          // handle_new_user() already inserted a bare profiles row synchronously when the
          // auth.users row was created above — this is an update, not an insert.
          const { error: profileError } = await supabaseAdmin
            .from("profiles")
            .update({
              full_name: fullName,
              deanery_id: body.deaneryId || null,
              parish_id: body.parishId || null,
              outstation_id: body.outstationId || null,
            })
            .eq("id", userId);
          if (profileError) return jsonError(profileError.message, 500);

          const { error: roleError } = await supabaseAdmin
            .from("user_roles")
            .insert({ user_id: userId, role });
          if (roleError) return jsonError(roleError.message, 500);

          return jsonOk({ userId, email });
        } catch (err) {
          // Most commonly: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set on this
          // deployment's env — createSupabaseAdminClient() throws synchronously on first use.
          console.error("[invite-user] unhandled error", err);
          return jsonError(
            err instanceof Error ? err.message : "Server misconfiguration — invite failed",
            500,
          );
        }
      },
    },
  },
});
