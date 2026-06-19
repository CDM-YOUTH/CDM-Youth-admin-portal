import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarDays } from "lucide-react";

/* ── types ── */

export type DateRange = { from: Date | undefined; to: Date | undefined };

/* ── helpers ── */

function sod(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function today(): Date { return sod(new Date()); }

function daysAgo(n: number): Date {
  const d = today();
  d.setDate(d.getDate() - n);
  return d;
}

function monthsAgo(n: number): Date {
  const d = today();
  d.setMonth(d.getMonth() - n);
  return d;
}

function fmt(d: Date): string {
  return d.toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}

/* ── presets ── */

type PresetKey = "today" | "yesterday" | "7d" | "14d" | "30d" | "3m" | "6m" | "1y" | "custom";

const PRESETS: { key: PresetKey; label: string; getRange: () => DateRange }[] = [
  { key: "today",     label: "Today",         getRange: () => ({ from: today(),        to: today()        }) },
  { key: "yesterday", label: "Yesterday",     getRange: () => { const d = daysAgo(1);  return { from: d, to: d }; } },
  { key: "7d",        label: "Last 7 days",   getRange: () => ({ from: daysAgo(6),     to: today()        }) },
  { key: "14d",       label: "Last 14 days",  getRange: () => ({ from: daysAgo(13),    to: today()        }) },
  { key: "30d",       label: "Last 30 days",  getRange: () => ({ from: daysAgo(29),    to: today()        }) },
  { key: "3m",        label: "Last 3 months", getRange: () => ({ from: monthsAgo(3),   to: today()        }) },
  { key: "6m",        label: "Last 6 months", getRange: () => ({ from: monthsAgo(6),   to: today()        }) },
  { key: "1y",        label: "Last year",     getRange: () => ({ from: monthsAgo(12),  to: today()        }) },
  { key: "custom",    label: "Custom",        getRange: () => ({ from: undefined,       to: undefined      }) },
];

function detectPreset(r: DateRange): PresetKey {
  if (!r.from) return "custom";
  const t = today().getTime();
  const f = r.from.getTime();
  const to = (r.to ?? today()).getTime();
  if (f === t && to === t)                                return "today";
  if (f === daysAgo(1).getTime() && to === daysAgo(1).getTime()) return "yesterday";
  if (f === daysAgo(6).getTime()  && to === t)           return "7d";
  if (f === daysAgo(13).getTime() && to === t)           return "14d";
  if (f === daysAgo(29).getTime() && to === t)           return "30d";
  return "custom";
}

export function getRangeLabel(r: DateRange): string {
  if (!r.from) return "All time";
  const key = detectPreset(r);
  if (key !== "custom") return PRESETS.find((p) => p.key === key)!.label;
  if (!r.to || r.from.getTime() === r.to.getTime()) return fmt(r.from);
  return `${fmt(r.from)} – ${fmt(r.to)}`;
}

/* ── inDateRange utility (exported for filtering) ── */

export function inDateRange(isoDate: string, r: DateRange): boolean {
  if (!r.from) return true;
  const ts   = new Date(isoDate).getTime();
  const from = sod(r.from).getTime();
  const to   = r.to ? new Date(r.to).setHours(23, 59, 59, 999) : new Date(r.from).setHours(23, 59, 59, 999);
  return ts >= from && ts <= to;
}

/* ── component ── */

export function DateRangeFilter({
  value,
  onChange,
  className,
}: {
  value: DateRange;
  onChange: (r: DateRange) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange>(value);
  const [activePreset, setActivePreset] = useState<PresetKey>(() => detectPreset(value));

  const handleOpen = (o: boolean) => {
    if (o) { setDraft(value); setActivePreset(detectPreset(value)); }
    setOpen(o);
  };

  const handlePreset = (p: typeof PRESETS[number]) => {
    setActivePreset(p.key);
    if (p.key !== "custom") setDraft(p.getRange());
  };

  // react-day-picker returns DateRange | undefined in range mode
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleCalendar = (range: any) => {
    setDraft(range ?? { from: undefined, to: undefined });
    setActivePreset("custom");
  };

  const apply = () => { onChange(draft); setOpen(false); };
  const clear  = () => { const e: DateRange = { from: undefined, to: undefined }; onChange(e); setOpen(false); };

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <button
          className={`flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-[11px] font-semibold text-text-1 shadow-sm transition-colors hover:bg-bg-2 ${className ?? ""}`}
        >
          <CalendarDays className="h-3.5 w-3.5 shrink-0 text-text-3" />
          {getRangeLabel(value)}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-auto border border-border bg-white p-0 shadow-xl"
      >
        <div className="flex divide-x divide-border">
          {/* Left: preset list */}
          <div className="w-36 py-1.5">
            {PRESETS.map((preset) => (
              <button
                key={preset.key}
                onClick={() => handlePreset(preset)}
                className={`w-full px-3 py-2 text-left text-[11px] transition-colors hover:bg-bg-2 ${
                  activePreset === preset.key
                    ? "border-l-2 border-danger font-bold text-danger"
                    : "border-l-2 border-transparent font-medium text-text-1"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Right: calendar */}
          <div className="p-1">
            <Calendar
              mode="range"
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              selected={draft as any}
              onSelect={handleCalendar}
              defaultMonth={draft.from}
              numberOfMonths={1}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-border px-3 py-2">
          <button
            onClick={clear}
            className="text-[11px] font-semibold text-text-3 transition-colors hover:text-text-1"
          >
            Clear
          </button>
          <button
            onClick={apply}
            className="rounded-md bg-danger px-4 py-1.5 text-[11px] font-bold text-white transition-opacity hover:opacity-90"
          >
            Apply
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
