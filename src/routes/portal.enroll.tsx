import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { fetchOrg } from "@/lib/db/org";
import {
  getMyYouth,
  claimYouthByCdmId,
  createMyYouth,
  enrollMeForYear,
  listMyEnrollments,
} from "@/lib/db/portal";
import type { YouthCategory, Gender } from "@/lib/db/youth-records/youths";

export const Route = createFileRoute("/portal/enroll")({
  component: EnrollPage,
});

function EnrollPage() {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAuthed(!!data.user));
  }, []);

  const me = useQuery({
    queryKey: ["portal", "me"],
    queryFn: getMyYouth,
    enabled: !!authed,
  });

  if (authed === null) return <CenteredMsg msg="Loading…" />;
  if (!authed) {
    return (
      <CenteredMsg
        msg="Sign in to enroll"
        action={
          <Link
            to="/portal/auth"
            search={{ mode: "signin" }}
            className="rounded-xl bg-danger px-4 py-2.5 text-[13px] font-bold text-white"
          >
            Sign In
          </Link>
        }
      />
    );
  }
  if (me.isLoading) return <CenteredMsg msg="Loading your record…" />;

  if (!me.data) {
    return <ClaimOrCreateForm onLinked={() => me.refetch()} />;
  }

  return <EnrollForm youthId={me.data.id} onDone={() => navigate({ to: "/portal/account" })} />;
}

function ClaimOrCreateForm({ onLinked }: { onLinked: () => void }) {
  const [tab, setTab] = useState<"claim" | "create">("claim");
  return (
    <div className="px-5 pt-6">
      <h1 className="text-display text-xl font-extrabold text-danger">Set up your record</h1>
      <p className="mt-1 text-[12px] text-text-3">
        Already registered with the Diocese? Claim your existing record using your CDM number.
        Otherwise create a new youth record.
      </p>

      <div className="mt-5 grid grid-cols-2 rounded-2xl border border-border bg-white p-1">
        <button
          onClick={() => setTab("claim")}
          className={`rounded-xl py-2 text-[12px] font-bold transition-colors ${
            tab === "claim" ? "bg-danger text-white" : "text-text-3"
          }`}
        >
          Claim by CDM ID
        </button>
        <button
          onClick={() => setTab("create")}
          className={`rounded-xl py-2 text-[12px] font-bold transition-colors ${
            tab === "create" ? "bg-danger text-white" : "text-text-3"
          }`}
        >
          New registration
        </button>
      </div>

      <div className="mt-5">
        {tab === "claim" ? <ClaimForm onDone={onLinked} /> : <CreateForm onDone={onLinked} />}
      </div>
    </div>
  );
}

function ClaimForm({ onDone }: { onDone: () => void }) {
  const [cdmId, setCdmId] = useState("");
  const [loading, setLoading] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
          await claimYouthByCdmId(cdmId);
          toast.success("Record claimed");
          onDone();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed to claim");
        } finally {
          setLoading(false);
        }
      }}
      className="space-y-4"
    >
      <div className="space-y-1.5">
        <label className="block text-[10px] font-bold uppercase tracking-wide text-gold-3">
          CDM ID
        </label>
        <Input
          value={cdmId}
          onChange={(e) => setCdmId(e.target.value)}
          placeholder="CDM-2025-00123"
          required
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-2xl bg-danger py-3.5 text-[14px] font-bold text-white disabled:opacity-60"
      >
        {loading ? "Linking…" : "Claim record"}
      </button>
    </form>
  );
}

const CATEGORIES: YouthCategory[] = ["Primary", "Secondary", "Tertiary", "Working"];
const GENDERS: Gender[] = ["Female", "Male"];

function CreateForm({ onDone }: { onDone: () => void }) {
  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState<Gender>("Female");
  const [age, setAge] = useState<number | "">("");
  const [phone, setPhone] = useState("");
  const [category, setCategory] = useState<YouthCategory>("Secondary");
  const [deaneryName, setDeaneryName] = useState("");
  const [parishName, setParishName] = useState("");
  const [loading, setLoading] = useState(false);

  const org = useQuery({ queryKey: ["org"], queryFn: fetchOrg });
  const parishes = deaneryName ? (org.data?.parishesByDeaneryName.get(deaneryName) ?? []) : [];

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (typeof age !== "number") return;
        setLoading(true);
        try {
          await createMyYouth({
            fullName,
            gender,
            age,
            phone: phone || undefined,
            category,
            deaneryName: deaneryName || undefined,
            parishName: parishName || undefined,
          });
          toast.success("Record created");
          onDone();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed to create");
        } finally {
          setLoading(false);
        }
      }}
      className="space-y-4"
    >
      <Field label="Full name">
        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Gender">
          <Select value={gender} onChange={(v) => setGender(v as Gender)} options={GENDERS} />
        </Field>
        <Field label="Age">
          <Input
            type="number"
            min={5}
            max={60}
            value={age}
            onChange={(e) => setAge(e.target.value ? Number(e.target.value) : "")}
            required
          />
        </Field>
      </div>
      <Field label="Phone (optional)">
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XX XXX XXX" />
      </Field>
      <Field label="Category">
        <Select value={category} onChange={(v) => setCategory(v as YouthCategory)} options={CATEGORIES} />
      </Field>
      <Field label="Deanery">
        <Select
          value={deaneryName}
          onChange={(v) => {
            setDeaneryName(v);
            setParishName("");
          }}
          options={(org.data?.deaneries ?? []).map((d) => d.name)}
          placeholder="Select deanery"
        />
      </Field>
      <Field label="Parish">
        <Select
          value={parishName}
          onChange={setParishName}
          options={parishes.map((p) => p.name)}
          placeholder={deaneryName ? "Select parish" : "Choose deanery first"}
          disabled={!deaneryName}
        />
      </Field>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-2xl bg-danger py-3.5 text-[14px] font-bold text-white disabled:opacity-60"
      >
        {loading ? "Creating…" : "Create record"}
      </button>
    </form>
  );
}

function EnrollForm({ youthId, onDone }: { youthId: string; onDone: () => void }) {
  const year = new Date().getFullYear();
  const [paymentRef, setPaymentRef] = useState("");
  const [loading, setLoading] = useState(false);

  const existing = useQuery({
    queryKey: ["portal", "enrollments", youthId],
    queryFn: () => listMyEnrollments(youthId),
  });

  const alreadyThisYear = existing.data?.find((e) => e.year === year);

  return (
    <div className="px-5 pt-6">
      <h1 className="text-display text-xl font-extrabold text-danger">Annual enrollment</h1>
      <p className="mt-1 text-[12px] text-text-3">
        Enroll for the {year} membership year.
      </p>

      {alreadyThisYear ? (
        <div className="mt-5 rounded-2xl border border-success/30 bg-success-soft px-4 py-4 text-[13px] text-success">
          You are already enrolled for {year}. Status:{" "}
          <strong className="capitalize">{alreadyThisYear.status}</strong>
        </div>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            try {
              await enrollMeForYear(youthId, year, paymentRef || undefined);
              toast.success(`Enrolled for ${year}. Awaiting confirmation.`);
              onDone();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Failed to enroll");
            } finally {
              setLoading(false);
            }
          }}
          className="mt-5 space-y-4"
        >
          <Field label="M-Pesa / payment reference (optional)">
            <Input
              value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
              placeholder="QXY1A2B3CD"
            />
          </Field>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-danger py-3.5 text-[14px] font-bold text-white disabled:opacity-60"
          >
            {loading ? "Submitting…" : `Enroll for ${year} →`}
          </button>
        </form>
      )}

      <h2 className="mt-8 text-[11px] font-bold uppercase tracking-wider text-gold-3">History</h2>
      <div className="mt-2 space-y-2">
        {(existing.data ?? []).map((e) => (
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
        {existing.data && existing.data.length === 0 && (
          <div className="text-[11px] text-text-3">No previous enrollments.</div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[10px] font-bold uppercase tracking-wide text-gold-3">
        {label}
      </label>
      {children}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="h-10 w-full rounded-md border border-input bg-white px-3 text-[13px] text-foreground disabled:opacity-50"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function CenteredMsg({ msg, action }: { msg: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-5 py-20 text-center">
      <p className="text-[13px] text-text-3">{msg}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}