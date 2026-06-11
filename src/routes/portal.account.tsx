import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LogOut, BadgeCheck, Mail, Phone, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMyYouth, listMyEnrollments } from "@/lib/db/portal";

export const Route = createFileRoute("/portal/account")({
  component: AccountPage,
});

function AccountPage() {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setAuthed(!!data.user);
      setEmail(data.user?.email ?? null);
    });
  }, []);

  const me = useQuery({
    queryKey: ["portal", "me"],
    queryFn: getMyYouth,
    enabled: !!authed,
  });

  const enrollments = useQuery({
    queryKey: ["portal", "enrollments", me.data?.id],
    queryFn: () => (me.data ? listMyEnrollments(me.data.id) : Promise.resolve([])),
    enabled: !!me.data,
  });

  if (authed === false) {
    return (
      <div className="px-5 pt-16 text-center">
        <p className="text-[13px] text-text-3">Sign in to view your account</p>
        <Link
          to="/portal/auth"
          search={{ mode: "signin" }}
          className="mt-4 inline-block rounded-xl bg-danger px-5 py-2.5 text-[13px] font-bold text-white"
        >
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="px-5 pt-6">
      <h1 className="text-display text-xl font-extrabold text-danger">My Account</h1>
      <p className="mt-1 text-[12px] text-text-3">{email}</p>

      {me.isLoading && <p className="mt-6 text-[12px] text-text-3">Loading…</p>}

      {!me.isLoading && !me.data && (
        <div className="mt-5 rounded-2xl border border-warn/30 bg-warn-soft px-4 py-4 text-[13px] text-gold-3">
          You don't have a youth record yet.{" "}
          <Link to="/portal/enroll" className="font-bold underline">
            Set one up
          </Link>
          .
        </div>
      )}

      {me.data && (
        <>
          <section className="mt-5 rounded-2xl border border-gold/30 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger-soft text-danger">
                {me.data.passport_url ? (
                  <img
                    src={me.data.passport_url}
                    alt={me.data.full_name}
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  <BadgeCheck className="h-6 w-6" />
                )}
              </div>
              <div>
                <div className="text-[14px] font-extrabold text-foreground">
                  {me.data.full_name}
                </div>
                <div className="text-[11px] font-bold text-gold-3">{me.data.cdm_id}</div>
              </div>
            </div>

            <dl className="mt-4 space-y-2 text-[12px]">
              <Row icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={me.data.email} />
              <Row icon={<Phone className="h-3.5 w-3.5" />} label="Phone" value={me.data.phone} />
              <Row
                icon={<MapPin className="h-3.5 w-3.5" />}
                label="Parish"
                value={
                  me.data.parish?.name
                    ? `${me.data.parish.name}${me.data.deanery?.name ? " · " + me.data.deanery.name : ""}`
                    : null
                }
              />
              <Row label="Category" value={me.data.category} />
              <Row label="Age" value={String(me.data.age)} />
            </dl>
          </section>

          <section className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-gold-3">
                Enrollments
              </h2>
              <Link
                to="/portal/enroll"
                className="text-[11px] font-bold text-danger"
              >
                Enroll →
              </Link>
            </div>
            <div className="space-y-2">
              {(enrollments.data ?? []).map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-white px-4 py-3 text-[12px]"
                >
                  <div>
                    <div className="font-bold text-foreground">{e.year}</div>
                    <div className="text-text-3">{e.category ?? "—"}</div>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      e.status === "paid"
                        ? "bg-success-soft text-success"
                        : "bg-warn-soft text-gold-3"
                    }`}
                  >
                    {e.status}
                  </span>
                </div>
              ))}
              {enrollments.data?.length === 0 && (
                <div className="text-[11px] text-text-3">No enrollments yet.</div>
              )}
            </div>
          </section>
        </>
      )}

      <button
        onClick={async () => {
          await supabase.auth.signOut();
          await navigate({ to: "/portal" });
        }}
        className="mx-auto mt-8 flex items-center gap-1.5 text-[12px] font-semibold text-text-3 hover:text-danger"
      >
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    </div>
  );
}

function Row({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex items-center gap-2">
      {icon && <span className="text-text-3">{icon}</span>}
      <dt className="w-16 text-text-3">{label}</dt>
      <dd className="flex-1 font-medium text-foreground">{value || "—"}</dd>
    </div>
  );
}