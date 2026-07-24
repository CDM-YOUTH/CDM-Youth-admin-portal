import { createFileRoute } from "@tanstack/react-router";
import { Topbar } from "@/components/admin/layout/topbar";
import { Card, CardBody, CardHead } from "@/components/admin/composables/ui-bits";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({
    meta: [
      { title: "Settings — CDM Youth Office" },
      { name: "description", content: "Configure diocese, deaneries, parishes, roles, and notification settings." },
    ],
  }),
  component: SettingsPage,
});

function Toggle({ on }: { on: boolean }) {
  return (
    <span
      className={`relative inline-block h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
        on ? "bg-success" : "bg-bg-4"
      }`}
    >
      <span
        className={`absolute top-[2px] h-4 w-4 rounded-full bg-white transition-transform ${
          on ? "translate-x-[18px]" : "translate-x-[2px]"
        }`}
      />
    </span>
  );
}

const ROWS = [
  { label: "Enable SMS notifications", desc: "Sends SMS via Africa's Talking gateway", on: true },
  { label: "Allow youth self-registration", desc: "Youth Portal sign-ups awaiting parish approval", on: true },
  { label: "Auto-run Mission Week reshuffle", desc: "Run algorithm at end of nomination phase", on: false },
  { label: "Anonymise welfare cases in reports", desc: "Strips names from exported reports", on: true },
  { label: "Lock enrollment after window closes", desc: "Prevent new registrations past 30 Apr", on: true },
];

function SettingsPage() {
  return (
    <>
      <Topbar
        title="System Settings"
        description="Diocese-level configuration. Changes apply across all parishes."
      />
      <div className="flex-1 overflow-y-auto px-5 py-4">

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Card>
            <CardHead title="Notifications & Behaviour" />
            <CardBody>
              {ROWS.map((r) => (
                <div key={r.label} className="flex items-center gap-3 border-b border-border/30 py-3 last:border-0">
                  <div className="flex-1">
                    <div className="text-[12px] font-semibold text-text-1">{r.label}</div>
                    <div className="text-[10px] text-text-3">{r.desc}</div>
                  </div>
                  <Toggle on={r.on} />
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHead title="Diocese Structure" subtitle="1 Diocese · 8 Deaneries · 56 Parishes" />
            <CardBody className="space-y-1.5">
              {[
                ["Muranga Central", 9],
                ["Mwea Deanery", 7],
                ["Kangema Deanery", 6],
                ["Kirinyaga West", 8],
                ["Kigumo Deanery", 7],
                ["Kahuro Deanery", 5],
                ["Gatanga Deanery", 7],
                ["Kandara Deanery", 7],
              ].map(([name, count]) => (
                <div key={name} className="flex items-center justify-between rounded-md bg-bg-2 px-3 py-2">
                  <span className="text-[11px] text-text-1">{name as string}</span>
                  <span className="text-[10px] font-bold text-gold">{count} parishes</span>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
