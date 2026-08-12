import { useMemo, useState } from "react";
import { QrCode, Search, Users, Link2, UserPlus, Check, X, Camera, Download } from "lucide-react";
import { Card, CardBody, CardHead, Pill } from "@/components/admin/composables/ui-bits";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ORGANIZATION } from "@/lib/mock-data";
import { YOUTH_REGISTRY, type YouthRecord } from "@/lib/youth-data";
import { TablePagination, usePagination } from "@/components/admin/composables/tables/table-pagination";

type CheckinKind = "member" | "guest";
export type CheckinEntry = {
  id: string;
  cdmId: string;
  name: string;
  kind: CheckinKind;
  parish: string;
  time: string;
  method: "search" | "qr" | "bulk" | "kiosk" | "walkin";
};

const TABS = [
  { id: "search", label: "Search", icon: Search },
  { id: "qr", label: "QR Scan", icon: QrCode },
  { id: "bulk", label: "Bulk by Parish", icon: Users },
  { id: "kiosk", label: "Kiosk Link", icon: Link2 },
] as const;
type TabId = (typeof TABS)[number]["id"];

function pad(n: number, w: number) {
  return String(n).padStart(w, "0");
}

export function EventCheckinPanel({ eventId, eventName }: { eventId: string; eventName: string }) {
  const [tab, setTab] = useState<TabId>("search");
  const [entries, setEntries] = useState<CheckinEntry[]>([]);
  const [walkin, setWalkin] = useState<"closed" | "ask" | "guest" | "enroll">("closed");

  const checkedIds = useMemo(() => new Set(entries.map((e) => e.id)), [entries]);

  const checkInMember = (youth: YouthRecord, method: CheckinEntry["method"]) => {
    if (checkedIds.has(youth.id)) return;
    setEntries((prev) => [
      {
        id: youth.id,
        cdmId: youth.cdmId,
        name: youth.name,
        kind: "member",
        parish: youth.parishName,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        method,
      },
      ...prev,
    ]);
  };

  const checkInGuest = (data: { name: string; phone: string; parish: string }) => {
    const id = `guest-${Date.now()}`;
    setEntries((prev) => [
      {
        id,
        cdmId: "—",
        name: data.name,
        kind: "guest",
        parish: data.parish || "Walk-in",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        method: "walkin",
      },
      ...prev,
    ]);
  };

  const enrollAndCheckIn = (data: {
    name: string;
    gender: string;
    parish: string;
    deanery: string;
    phone: string;
  }) => {
    const newSerial = YOUTH_REGISTRY.length + entries.filter((e) => e.kind === "member" && e.id.startsWith("walk-")).length + 1;
    const cdmId = `CDM-2026-${pad(newSerial, 5)}`;
    const id = `walk-${Date.now()}`;
    setEntries((prev) => [
      {
        id,
        cdmId,
        name: data.name,
        kind: "member",
        parish: data.parish || "Walk-in",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        method: "walkin",
      },
      ...prev,
    ]);
  };

  const removeEntry = (id: string) => setEntries((prev) => prev.filter((e) => e.id !== id));

  const memberCount = entries.filter((e) => e.kind === "member").length;
  const guestCount = entries.filter((e) => e.kind === "guest").length;

  return (
    <Card>
      <CardHead
        title="Day-of Check-in"
        subtitle={`${entries.length} checked in · ${memberCount} members · ${guestCount} guests`}
        action={
          <button
            onClick={() => setWalkin("ask")}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground"
          >
            <UserPlus className="h-3.5 w-3.5" /> Add walk-in
          </button>
        }
      />
      <CardBody className="space-y-3">
        <div className="flex flex-wrap gap-1.5 border-b border-border pb-2">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[11px] font-bold ${
                  active
                    ? "border-gold bg-warn-soft text-gold"
                    : "border-border bg-bg-2 text-text-2 hover:text-text-1"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === "search" && <SearchTab onCheckIn={(y) => checkInMember(y, "search")} checkedIds={checkedIds} />}
        {tab === "qr" && <QrTab onCheckIn={(y) => checkInMember(y, "qr")} checkedIds={checkedIds} />}
        {tab === "bulk" && <BulkTab onCheckIn={(y) => checkInMember(y, "bulk")} checkedIds={checkedIds} />}
        {tab === "kiosk" && <KioskTab eventId={eventId} eventName={eventName} />}

        <DayRegister entries={entries} onRemove={removeEntry} />
      </CardBody>

      <WalkInDialog
        state={walkin}
        setState={setWalkin}
        onGuest={(d) => {
          checkInGuest(d);
          setWalkin("closed");
        }}
        onEnroll={(d) => {
          enrollAndCheckIn(d);
          setWalkin("closed");
        }}
      />
    </Card>
  );
}

function SearchTab({
  onCheckIn,
  checkedIds,
}: {
  onCheckIn: (y: YouthRecord) => void;
  checkedIds: Set<string>;
}) {
  const [q, setQ] = useState("");
  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return YOUTH_REGISTRY.filter(
      (y) => y.name.toLowerCase().includes(term) || y.cdmId.toLowerCase().includes(term),
    ).slice(0, 12);
  }, [q]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-3" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by Unique No. (CDM-2026-…) or name"
          className="pl-9"
        />
      </div>
      {q && results.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-bg-2 p-3 text-[11px] text-text-3">
          No youth found. Try the walk-in flow above.
        </div>
      )}
      <div className="space-y-1.5">
        {results.map((y) => {
          const done = checkedIds.has(y.id);
          return (
            <div key={y.id} className="flex items-center gap-2 rounded-lg border border-border bg-bg-2 p-2.5">
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-bold text-text-1">{y.name}</div>
                <div className="text-[10px] text-text-3">
                  {y.cdmId} · {y.parishName} · {y.gender}
                </div>
              </div>
              <button
                disabled={done}
                onClick={() => onCheckIn(y)}
                className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-[10px] font-bold ${
                  done
                    ? "border border-success/40 bg-success-soft text-success"
                    : "bg-primary text-primary-foreground hover:opacity-90"
                }`}
              >
                {done ? <><Check className="h-3 w-3" /> Checked in</> : "Check in"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QrTab({
  onCheckIn,
  checkedIds,
}: {
  onCheckIn: (y: YouthRecord) => void;
  checkedIds: Set<string>;
}) {
  const [scanning, setScanning] = useState(false);
  const [manual, setManual] = useState("");
  const [last, setLast] = useState<YouthRecord | null>(null);

  const tryCheckIn = (cdmId: string) => {
    const youth = YOUTH_REGISTRY.find((y) => y.cdmId.toLowerCase() === cdmId.trim().toLowerCase());
    if (youth) {
      onCheckIn(youth);
      setLast(youth);
    } else {
      setLast(null);
    }
  };

  const simulateScan = () => {
    const sample = YOUTH_REGISTRY[Math.floor(Math.random() * YOUTH_REGISTRY.length)];
    if (sample) tryCheckIn(sample.cdmId);
  };

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="flex aspect-video flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-bg-2 p-4 text-center">
        <Camera className="mb-2 h-8 w-8 text-text-3" />
        {scanning ? (
          <>
            <div className="text-[11px] font-bold text-text-1">Camera active</div>
            <div className="mb-2 text-[10px] text-text-3">Point at a youth's CDM QR code</div>
            <button
              onClick={simulateScan}
              className="rounded-md bg-primary px-3 py-1.5 text-[10px] font-bold text-primary-foreground"
            >
              Simulate scan
            </button>
            <button
              onClick={() => setScanning(false)}
              className="mt-1.5 text-[10px] font-bold text-text-3 underline"
            >
              Stop
            </button>
          </>
        ) : (
          <button
            onClick={() => setScanning(true)}
            className="rounded-md bg-primary px-3 py-2 text-[11px] font-bold text-primary-foreground"
          >
            Start camera
          </button>
        )}
      </div>
      <div className="space-y-2">
        <div className="text-[10px] font-bold uppercase tracking-wide text-text-3">
          Or enter Unique No. manually
        </div>
        <div className="flex gap-2">
          <Input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="CDM-2026-00123"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                tryCheckIn(manual);
                setManual("");
              }
            }}
          />
          <button
            onClick={() => {
              tryCheckIn(manual);
              setManual("");
            }}
            className="rounded-md bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground"
          >
            Check in
          </button>
        </div>
        {last && (
          <div className="rounded-lg border border-success/40 bg-success-soft p-2.5">
            <div className="text-[11px] font-bold text-success">
              {checkedIds.has(last.id) ? "✓ Checked in" : "Found"}
            </div>
            <div className="text-[11px] font-bold text-text-1">{last.name}</div>
            <div className="text-[10px] text-text-3">
              {last.cdmId} · {last.parishName}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BulkTab({
  onCheckIn,
  checkedIds,
}: {
  onCheckIn: (y: YouthRecord) => void;
  checkedIds: Set<string>;
}) {
  const [deanery, setDeanery] = useState<string>(ORGANIZATION[0]?.code ?? "");
  const parishes = useMemo(
    () => ORGANIZATION.find((d) => d.code === deanery)?.parishes ?? [],
    [deanery],
  );
  const [parishId, setParishId] = useState<string>(parishes[0]?.id ?? "");
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const roster = useMemo(
    () => YOUTH_REGISTRY.filter((y) => y.parishId === parishId),
    [parishId],
  );

  const toggle = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const checkInSelected = () => {
    roster.filter((y) => picked.has(y.id)).forEach(onCheckIn);
    setPicked(new Set());
  };

  const selectAll = () => {
    setPicked(new Set(roster.filter((y) => !checkedIds.has(y.id)).map((y) => y.id)));
  };

  return (
    <div className="space-y-2">
      <div className="grid gap-2 md:grid-cols-2">
        <Select value={deanery} onValueChange={(v) => { setDeanery(v); setParishId(""); }}>
          <SelectTrigger><SelectValue placeholder="Deanery" /></SelectTrigger>
          <SelectContent>
            {ORGANIZATION.map((d) => <SelectItem key={d.code} value={d.code}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={parishId} onValueChange={setParishId}>
          <SelectTrigger><SelectValue placeholder="Parish" /></SelectTrigger>
          <SelectContent>
            {parishes.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-between text-[10px] text-text-3">
        <span>{roster.length} youth in roster · {picked.size} selected</span>
        <div className="flex gap-2">
          <button onClick={selectAll} className="font-bold text-gold underline">Select all</button>
          <button
            onClick={checkInSelected}
            disabled={picked.size === 0}
            className="rounded-md bg-primary px-2.5 py-1 text-[10px] font-bold text-primary-foreground disabled:opacity-40"
          >
            Check in {picked.size || ""}
          </button>
        </div>
      </div>
      <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-border bg-bg-2 p-2">
        {roster.length === 0 && (
          <div className="p-2 text-[11px] text-text-3">Pick a parish to load its roster.</div>
        )}
        {roster.map((y) => {
          const done = checkedIds.has(y.id);
          return (
            <label
              key={y.id}
              className={`flex cursor-pointer items-center gap-2 rounded-md border border-border bg-bg-3 p-2 ${done ? "opacity-50" : ""}`}
            >
              <Checkbox
                checked={picked.has(y.id)}
                disabled={done}
                onCheckedChange={() => toggle(y.id)}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] font-bold text-text-1">{y.name}</div>
                <div className="text-[9px] text-text-3">{y.cdmId} · {y.churchName}</div>
              </div>
              {done && <Pill tone="success">Checked in</Pill>}
            </label>
          );
        })}
      </div>
    </div>
  );
}

function KioskTab({ eventId, eventName }: { eventId: string; eventName: string }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}/checkin/${eventId}` : `/checkin/${eventId}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="grid gap-3 md:grid-cols-[220px_1fr]">
      <div className="rounded-lg border border-border bg-white p-2">
        <img src={qrUrl} alt={`QR code for ${eventName} kiosk`} className="h-full w-full" />
      </div>
      <div className="space-y-2">
        <div className="text-[11px] text-text-2">
          Open this link on a tablet at the entrance. Youth enter their <strong>Unique No.</strong> to check themselves in.
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-2 p-2.5">
          <code className="min-w-0 flex-1 truncate text-[11px] text-text-1">{url}</code>
          <button
            onClick={copy}
            className="rounded-md bg-primary px-3 py-1.5 text-[10px] font-bold text-primary-foreground"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <div className="rounded-lg border border-info/40 bg-info-soft p-2.5 text-[10px] text-info">
          Tip: print the QR and pin it at each parish booth so youth scan & self-check-in.
        </div>
      </div>
    </div>
  );
}

function DayRegister({ entries, onRemove }: { entries: CheckinEntry[]; onRemove: (id: string) => void }) {
  const [filter, setFilter] = useState("");
  const orderedEntries = useMemo(() => {
    const kindRank: Record<CheckinKind, number> = { member: 0, guest: 1 };
    return [...entries].sort((a, b) => kindRank[a.kind] - kindRank[b.kind]);
  }, [entries]);
  const filtered = useMemo(() => {
    const term = filter.trim().toLowerCase();
    if (!term) return orderedEntries;
    return orderedEntries.filter(
      (e) =>
        e.name.toLowerCase().includes(term) ||
        e.cdmId.toLowerCase().includes(term) ||
        e.parish.toLowerCase().includes(term),
    );
  }, [orderedEntries, filter]);
  const pagination = usePagination(filtered, 10);

  const exportCsv = () => {
    const header = "Time,CDM No,Name,Type,Parish,Method";
    const rows = orderedEntries.map((e) => `${e.time},${e.cdmId},"${e.name}",${e.kind},"${e.parish}",${e.method}`);
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `day-register-${Date.now()}.csv`;
    a.click();
  };

  return (
    <div className="space-y-2 border-t border-border pt-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[12px] font-black text-text-1">Day Register ({entries.length})</div>
        <div className="flex items-center gap-2">
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter register"
            className="h-7 w-44 text-[11px]"
          />
          <button
            onClick={exportCsv}
            disabled={entries.length === 0}
            className="flex items-center gap-1 rounded-md border border-border bg-bg-3 px-2.5 py-1 text-[10px] font-bold text-text-1 disabled:opacity-40"
          >
            <Download className="h-3 w-3" /> Export
          </button>
        </div>
      </div>
      {entries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-bg-2 p-4 text-center text-[11px] text-text-3">
          No check-ins yet. Search, scan, or bulk-select to begin.
        </div>
      ) : (
        <>
          <div className="max-h-72 overflow-y-auto rounded-lg border border-border bg-bg-2">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 bg-bg-3 text-text-3">
                <tr>
                  <th className="px-2 py-1.5 text-left font-bold">Time</th>
                  <th className="px-2 py-1.5 text-left font-bold">CDM No.</th>
                  <th className="px-2 py-1.5 text-left font-bold">Name</th>
                  <th className="px-2 py-1.5 text-left font-bold">Type</th>
                  <th className="px-2 py-1.5 text-left font-bold">Parish</th>
                  <th className="px-2 py-1.5 text-right font-bold">Action</th>
                </tr>
              </thead>
              <tbody>
                {pagination.pageRows.map((e) => (
                  <tr key={e.id} className="border-t border-border">
                    <td className="px-2 py-1.5 text-text-2">{e.time}</td>
                    <td className="px-2 py-1.5 font-bold text-text-1">{e.cdmId}</td>
                    <td className="px-2 py-1.5 text-text-1">{e.name}</td>
                    <td className="px-2 py-1.5">
                      <Pill tone={e.kind === "member" ? "success" : "info"}>{e.kind}</Pill>
                    </td>
                    <td className="px-2 py-1.5 text-text-2">{e.parish}</td>
                    <td className="px-2 py-1.5 text-right">
                      <button
                        onClick={() => onRemove(e.id)}
                        className="rounded-md border border-border bg-bg-3 px-2 py-0.5 text-[10px] font-bold text-text-3 hover:text-danger"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePagination
            page={pagination.page}
            pageSize={pagination.pageSize}
            total={pagination.total}
            totalPages={pagination.totalPages}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
          />
        </>
      )}
    </div>
  );
}

function WalkInDialog({
  state,
  setState,
  onGuest,
  onEnroll,
}: {
  state: "closed" | "ask" | "guest" | "enroll";
  setState: (s: "closed" | "ask" | "guest" | "enroll") => void;
  onGuest: (d: { name: string; phone: string; parish: string }) => void;
  onEnroll: (d: { name: string; gender: string; parish: string; deanery: string; phone: string }) => void;
}) {
  const [guest, setGuest] = useState({ name: "", phone: "", parish: "" });
  const [enroll, setEnroll] = useState({ name: "", gender: "", parish: "", deanery: "", phone: "" });
  const parishes = ORGANIZATION.flatMap((d) => d.parishes.map((p) => p.name));

  return (
    <Dialog open={state !== "closed"} onOpenChange={(open) => !open && setState("closed")}>
      <DialogContent className="max-w-md border-border bg-card text-foreground">
        {state === "ask" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-display text-lg font-black">Walk-in Attendee</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <p className="text-[12px] text-text-2">
                Are they joining CDM today (becoming a member), or just visiting as a guest?
              </p>
              <div className="grid gap-2">
                <button
                  onClick={() => setState("enroll")}
                  className="rounded-lg border border-success/40 bg-success-soft p-3 text-left"
                >
                  <div className="text-[12px] font-bold text-success">Yes — Joining CDM</div>
                  <div className="text-[10px] text-text-3">Quick enrollment + auto-generates a Unique No.</div>
                </button>
                <button
                  onClick={() => setState("guest")}
                  className="rounded-lg border border-info/40 bg-info-soft p-3 text-left"
                >
                  <div className="text-[12px] font-bold text-info">No — Just visiting</div>
                  <div className="text-[10px] text-text-3">Logged as a guest, counted separately.</div>
                </button>
              </div>
            </div>
          </>
        )}
        {state === "guest" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-display text-lg font-black">Guest Check-in</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <Field label="Full name">
                <Input value={guest.name} onChange={(e) => setGuest({ ...guest, name: e.target.value })} maxLength={100} />
              </Field>
              <Field label="Phone (optional)">
                <Input value={guest.phone} onChange={(e) => setGuest({ ...guest, phone: e.target.value })} maxLength={20} />
              </Field>
              <Field label="Parish (optional)">
                <Input value={guest.parish} onChange={(e) => setGuest({ ...guest, parish: e.target.value })} maxLength={80} />
              </Field>
            </div>
            <DialogFooter>
              <button onClick={() => setState("ask")} className="rounded-lg border border-border bg-bg-3 px-3 py-1.5 text-[11px] font-bold text-text-2">Back</button>
              <button
                disabled={!guest.name.trim()}
                onClick={() => { onGuest(guest); setGuest({ name: "", phone: "", parish: "" }); }}
                className="rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground disabled:opacity-40"
              >
                Check in guest
              </button>
            </DialogFooter>
          </>
        )}
        {state === "enroll" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-display text-lg font-black">Quick Enroll & Check In</DialogTitle>
            </DialogHeader>
            <div className="grid gap-2 py-2 md:grid-cols-2">
              <Field label="Full name">
                <Input value={enroll.name} onChange={(e) => setEnroll({ ...enroll, name: e.target.value })} maxLength={100} />
              </Field>
              <Field label="Phone">
                <Input value={enroll.phone} onChange={(e) => setEnroll({ ...enroll, phone: e.target.value })} maxLength={20} />
              </Field>
              <Field label="Gender">
                <Select value={enroll.gender} onValueChange={(v) => setEnroll({ ...enroll, gender: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Male">Male</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Deanery">
                <Select value={enroll.deanery} onValueChange={(v) => setEnroll({ ...enroll, deanery: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {ORGANIZATION.map((d) => <SelectItem key={d.code} value={d.name}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Parish">
                <Select value={enroll.parish} onValueChange={(v) => setEnroll({ ...enroll, parish: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {parishes.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="rounded-lg border border-info/40 bg-info-soft p-2 text-[10px] text-info">
              A Unique No. (CDM-2026-XXXXX) will be generated automatically on check-in.
            </div>
            <DialogFooter>
              <button onClick={() => setState("ask")} className="rounded-lg border border-border bg-bg-3 px-3 py-1.5 text-[11px] font-bold text-text-2">Back</button>
              <button
                disabled={!enroll.name.trim() || !enroll.gender || !enroll.parish}
                onClick={() => { onEnroll(enroll); setEnroll({ name: "", gender: "", parish: "", deanery: "", phone: "" }); }}
                className="rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground disabled:opacity-40"
              >
                Enroll & check in
              </button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1 text-[10px] font-bold uppercase tracking-wide text-text-3">
      <span>{label}</span>
      {children}
    </label>
  );
}
