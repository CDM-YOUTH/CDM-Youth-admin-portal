import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { looksLikeCdmId, normalizeKenyanPhone } from "@/lib/phone";
import { sha256Hex, randomDigits } from "./crypto";
import { sendSms } from "./sms";

async function resolvePhone(identifier: string): Promise<string | null> {
  const trimmed = identifier.trim();
  if (looksLikeCdmId(trimmed)) {
    const { data } = await supabaseAdmin
      .from("youths")
      .select("phone")
      .eq("cdm_id", trimmed.toUpperCase())
      .maybeSingle();
    return data?.phone ?? null;
  }
  return normalizeKenyanPhone(trimmed);
}

// Resolves a CDM Number or phone number typed on the login screen to the
// phone number Supabase Auth needs — this must run server-side because an
// anonymous client can't read the youths table (see the RLS policies added
// in 20260703000000_youth_portal_auth.sql).
export const resolveLoginIdentifier = createServerFn({ method: "GET" })
  .inputValidator((identifier: string) => identifier)
  .handler(async ({ data: identifier }) => {
    const phone = await resolvePhone(identifier);
    return { phone };
  });

const registerSchema = z.object({
  fullName: z.string().min(2),
  gender: z.enum(["Male", "Female"]),
  dateOfBirth: z.string(),
  phone: z.string(),
  email: z.string().email().optional().or(z.literal("")),
  deaneryId: z.string().uuid().optional().or(z.literal("")),
  parishId: z.string().uuid().optional().or(z.literal("")),
  outstationId: z.string().uuid().optional().or(z.literal("")),
  category: z.enum(["Secondary", "Tertiary", "Working", "Other"]),
  password: z.string().min(8),
});

export type RegisterInput = z.infer<typeof registerSchema>;

function computeAge(dateOfBirth: string) {
  const dob = new Date(dateOfBirth);
  const ageMs = Date.now() - dob.getTime();
  return Math.max(0, Math.min(120, Math.floor(ageMs / (365.25 * 24 * 3600 * 1000))));
}

// Creates the Supabase Auth user and the linked youths row together. Uses
// the service-role client because anon/authenticated have no INSERT policy
// on youths by design — registration is the one trusted path that creates
// new members.
export const registerYouth = createServerFn({ method: "POST" })
  .inputValidator((input: RegisterInput) => registerSchema.parse(input))
  .handler(async ({ data }) => {
    const phone = normalizeKenyanPhone(data.phone);
    if (!phone) throw new Error("Enter a valid Kenyan phone number.");

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      phone,
      password: data.password,
      phone_confirm: true,
    });
    if (createErr || !created.user) {
      throw new Error(createErr?.message ?? "Could not create your account. The phone number may already be registered.");
    }

    const { data: youth, error: insertErr } = await supabaseAdmin
      .from("youths")
      .insert({
        auth_user_id: created.user.id,
        full_name: data.fullName,
        gender: data.gender,
        age: computeAge(data.dateOfBirth),
        phone,
        email: data.email || null,
        deanery_id: data.deaneryId || null,
        parish_id: data.parishId || null,
        outstation_id: data.outstationId || null,
        category: data.category,
      })
      .select("id, cdm_id")
      .single();

    if (insertErr || !youth) {
      // Don't strand an auth user with no member record behind it.
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error(insertErr?.message ?? "Could not complete registration.");
    }

    if (data.category === "Tertiary") {
      // Give CUSA members a stub record to fill in from the CUSA Space screen.
      await supabaseAdmin.from("cusa_members").insert({ youth_id: youth.id, institution: "Not set" });
    }

    return { cdmId: youth.cdm_id };
  });

const OTP_TTL_MINUTES = 10;

export const requestPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((identifier: string) => identifier)
  .handler(async ({ data: identifier }) => {
    const phone = await resolvePhone(identifier);
    // Always report success — don't reveal whether an account exists.
    if (!phone) return { ok: true };

    const code = randomDigits(6);
    const codeHash = await sha256Hex(code);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000).toISOString();

    await supabaseAdmin.from("otp_codes").insert({
      phone,
      code_hash: codeHash,
      purpose: "password_reset",
      expires_at: expiresAt,
    });

    await sendSms(phone, `Your CDM Youth Portal verification code is ${code}. It expires in ${OTP_TTL_MINUTES} minutes.`);
    return { ok: true };
  });

export const confirmPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((input: { identifier: string; code: string; newPassword: string }) => input)
  .handler(async ({ data }) => {
    const phone = await resolvePhone(data.identifier);
    if (!phone) throw new Error("Invalid or expired code.");

    const codeHash = await sha256Hex(data.code.trim());
    const { data: otpRow } = await supabaseAdmin
      .from("otp_codes")
      .select("*")
      .eq("phone", phone)
      .eq("purpose", "password_reset")
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const expired = !otpRow || new Date(otpRow.expires_at) < new Date();
    const mismatched = !otpRow || otpRow.code_hash !== codeHash;

    if (expired || mismatched) {
      if (otpRow) {
        await supabaseAdmin.from("otp_codes").update({ attempts: otpRow.attempts + 1 }).eq("id", otpRow.id);
      }
      throw new Error("Invalid or expired code.");
    }

    const { data: youth } = await supabaseAdmin
      .from("youths")
      .select("auth_user_id")
      .eq("phone", phone)
      .maybeSingle();

    if (!youth?.auth_user_id) throw new Error("Account not found.");

    await supabaseAdmin.auth.admin.updateUserById(youth.auth_user_id, { password: data.newPassword });
    await supabaseAdmin.from("otp_codes").update({ consumed_at: new Date().toISOString() }).eq("id", otpRow.id);

    return { ok: true };
  });
