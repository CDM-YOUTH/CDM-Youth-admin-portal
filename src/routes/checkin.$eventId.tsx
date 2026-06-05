import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { EVENTS } from "@/lib/mock-data";
import { YOUTH_REGISTRY } from "@/lib/youth-data";
import { Check, X } from "lucide-react";

export const Route = createFileRoute("/checkin/$eventId")({
  head: () => ({
    meta: [
      { title: "Event Check-in — CDM Youth" },
      { name: "description", content: "Self check-in kiosk for CDM youth events." },
    ],
  }),
  component: KioskPage,
});

function KioskPage() {
  const { eventId } = Route.useParams();
  const event = EVENTS.find((e) => e.id === eventId) ?? EVENTS[0];
  const [code, setCode] = useState("");
  const [result, setResult] = useState<{ ok: boolean; name?: string; cdm?: string } | null>(null);

  const submit = () => {
    const term = code.trim().toLowerCase();
    if (!term) return;
    const youth = YOUTH_REGISTRY.find(
      (y) => y.cdmId.toLowerCase() === term || y.name.toLowerCase().includes(term),
    );
    if (youth) {
      setResult({ ok: true, name: youth.name, cdm: youth.cdmId });
    } else {
      setResult({ ok: false });
    }
    setCode("");
    setTimeout(() => setResult(null), 4000);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-10">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-border bg-card p-8 shadow-lg">
        <div className="text-center">
          <div className="text-[10px] font-bold uppercase tracking-widest text-gold">CDM Self Check-in</div>
          <h1 className="text-display mt-1 text-2xl font-black text-foreground">{event.name}</h1>
          <p className="mt-1 text-[12px] text-text-3">{event.date} · {event.venue}</p>
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-bold uppercase tracking-wide text-text-3">
            Enter your Unique No. or Name
          </label>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="CDM-2026-00123"
            className="h-12 text-center text-lg"
            autoFocus
          />
          <button
            onClick={submit}
            className="w-full rounded-lg bg-primary py-3 text-sm font-black text-primary-foreground"
          >
            Check in
          </button>
        </div>

        {result && (
          <div
            className={`flex items-center gap-3 rounded-lg p-4 ${
              result.ok ? "border border-success/40 bg-success-soft" : "border border-danger/40 bg-danger-soft"
            }`}
          >
            {result.ok ? (
              <Check className="h-6 w-6 text-success" />
            ) : (
              <X className="h-6 w-6 text-danger" />
            )}
            <div>
              <div className={`text-sm font-bold ${result.ok ? "text-success" : "text-danger"}`}>
                {result.ok ? `Welcome, ${result.name}!` : "Not found"}
              </div>
              <div className="text-[11px] text-text-3">
                {result.ok ? `${result.cdm} · checked in` : "Please see the desk for help."}
              </div>
            </div>
          </div>
        )}

        <p className="text-center text-[10px] text-text-3">
          Don't have a Unique No.? Visit the registration desk to enroll.
        </p>
      </div>
    </main>
  );
}