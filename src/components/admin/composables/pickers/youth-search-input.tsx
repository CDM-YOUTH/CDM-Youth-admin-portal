import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import type { OrgTree } from "@/lib/db/org";

export type PickedYouth = {
  id: string;
  full_name: string;
  cdm_id: string;
  phone: string | null;
  email: string | null;
  deanery_id: string | null;
  parish_id: string | null;
  outstation_id: string | null;
  deanery_name: string;
  parish_name: string;
  outstation_name: string;
};

const SEL =
  "id, full_name, cdm_id, phone, email, deanery_id, parish_id, outstation_id, deanery:deaneries(name), parish:parishes(name), outstation:outstations(name)";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function map(y: any): PickedYouth {
  return {
    id:              y.id,
    full_name:       y.full_name,
    cdm_id:          y.cdm_id,
    phone:           y.phone           ?? null,
    email:           y.email           ?? null,
    deanery_id:      y.deanery_id      ?? null,
    parish_id:       y.parish_id       ?? null,
    outstation_id:   y.outstation_id   ?? null,
    deanery_name:    y.deanery?.name   ?? "",
    parish_name:     y.parish?.name    ?? "",
    outstation_name: y.outstation?.name ?? "",
  };
}

const selCls =
  "h-8 flex-1 min-w-[110px] rounded-md border border-border bg-bg-2 px-2 text-[11px] font-semibold text-text-1 outline-none focus:border-gold-3 disabled:opacity-50";

/** Selected-youth card — reused in both picked state and CDM preview */
function YouthCard({
  youth,
  action,
}: {
  youth: PickedYouth;
  action: React.ReactNode;
}) {
  return (
    <div className="space-y-1 rounded-lg border border-border bg-bg-2 p-3">
      <div className="text-[12px] font-bold text-text-1">{youth.full_name}</div>
      <div className="font-mono text-[10px] text-text-3">{youth.cdm_id}</div>
      {youth.phone && <div className="font-mono text-[10px] text-text-3">{youth.phone}</div>}
      {(youth.parish_name || youth.deanery_name) && (
        <div className="text-[10px] text-text-3">
          {[youth.outstation_name, youth.parish_name, youth.deanery_name].filter(Boolean).join(" · ")}
        </div>
      )}
      <div className="pt-0.5">{action}</div>
    </div>
  );
}

/**
 * Dual-mode youth picker: "By CDM No." (lookup by exact CDM) or
 * "Browse by location" (filter by deanery/parish/outstation + name search).
 *
 * When a youth is selected, renders a read-only card with an X to clear.
 * Pass `org` so the browse dropdowns are populated from real database data.
 */
export function YouthSearchInput({
  value,
  onChange,
  org,
}: {
  value: PickedYouth | null;
  onChange: (youth: PickedYouth | null) => void;
  org?: OrgTree;
}) {
  const [mode, setMode] = useState<"cdm" | "browse">("cdm");

  // CDM mode
  const [cdmInput,   setCdmInput]   = useState("");
  const [cdmPreview, setCdmPreview] = useState<PickedYouth | null>(null);
  const [cdmError,   setCdmError]   = useState("");
  const [cdmBusy,    setCdmBusy]    = useState(false);

  // Browse mode
  const [bDeanery,    setBDeanery]    = useState("");
  const [bParish,     setBParish]     = useState("");
  const [bOutstation, setBOutstation] = useState("");
  const [bSearch,     setBSearch]     = useState("");
  const [bResults,    setBResults]    = useState<PickedYouth[]>([]);

  // Derived location options from org tree
  const deaneries = org?.deaneries ?? [];
  const parishes  = useMemo(() => {
    if (!org) return [];
    return bDeanery ? (org.parishesByDeaneryName.get(bDeanery) ?? []) : org.parishes;
  }, [org, bDeanery]);
  const outstations = useMemo(() => {
    if (!org || !bParish) return [];
    return org.outstationsByParishName.get(bParish) ?? [];
  }, [org, bParish]);

  // CDM lookup
  const lookupCdm = async () => {
    const cdm = cdmInput.trim();
    if (!cdm) return;
    setCdmBusy(true);
    setCdmPreview(null);
    setCdmError("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any).from("youths").select(SEL).eq("cdm_id", cdm).maybeSingle();
    setCdmBusy(false);
    if (!data) { setCdmError(`No youth found with CDM No. "${cdm}"`); return; }
    setCdmPreview(map(data));
  };

  // Browse search — debounced, filtered by org unit IDs
  useEffect(() => {
    const term = bSearch.trim();
    if (term.length < 2) { setBResults([]); return; }
    let cancelled = false;
    const handle = setTimeout(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q = (supabase as any)
        .from("youths")
        .select(SEL)
        .or(`full_name.ilike.%${term}%,cdm_id.ilike.%${term}%`)
        .limit(20);
      if (bDeanery && org) {
        const d = org.deaneries.find((x) => x.name === bDeanery);
        if (d) q = q.eq("deanery_id", d.id);
      }
      if (bParish && org) {
        const p = org.parishes.find((x) => x.name === bParish);
        if (p) q = q.eq("parish_id", p.id);
      }
      if (bOutstation && org) {
        const o = org.outstations.find((x) => x.name === bOutstation);
        if (o) q = q.eq("outstation_id", o.id);
      }
      const { data } = await q;
      if (!cancelled) setBResults((data ?? []).map(map));
    }, 300);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [bSearch, bDeanery, bParish, bOutstation, org]);

  const reset = () => {
    setCdmInput(""); setCdmPreview(null); setCdmError("");
    setBDeanery(""); setBParish(""); setBOutstation(""); setBSearch(""); setBResults([]);
  };

  // Selected state — show read-only card
  if (value) {
    return (
      <div className="flex items-start justify-between rounded-lg border border-success/40 bg-success-soft px-3 py-2.5">
        <div className="space-y-0.5">
          <div className="text-[12px] font-semibold text-text-1">{value.full_name}</div>
          <div className="font-mono text-[10px] text-text-3">{value.cdm_id}</div>
          {value.phone && <div className="font-mono text-[10px] text-text-3">{value.phone}</div>}
          {(value.deanery_name || value.parish_name || value.outstation_name) && (
            <div className="text-[10px] text-text-3">
              {[value.deanery_name, value.parish_name, value.outstation_name].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => { onChange(null); reset(); }}
          className="ml-2 text-text-3 hover:text-danger"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Mode tabs */}
      <div className="flex gap-1 rounded-lg border border-border bg-bg-2 p-0.5">
        {(["cdm", "browse"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => { setMode(m); reset(); }}
            className={`flex-1 rounded-md py-1.5 text-[11px] font-bold transition ${
              mode === m
                ? "bg-white text-text-1 shadow-sm"
                : "text-text-3 hover:text-text-2"
            }`}
          >
            {m === "cdm" ? "By CDM No." : "Browse by location"}
          </button>
        ))}
      </div>

      {/* CDM mode */}
      {mode === "cdm" && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              value={cdmInput}
              onChange={(e) => { setCdmInput(e.target.value); setCdmPreview(null); setCdmError(""); }}
              onKeyDown={(e) => e.key === "Enter" && lookupCdm()}
              placeholder="CDM-2026-00001"
              className="flex-1 font-mono"
            />
            <button
              type="button"
              onClick={lookupCdm}
              disabled={cdmBusy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 text-[11px] font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              <Search className="h-3.5 w-3.5" />
              {cdmBusy ? "Looking…" : "Look up"}
            </button>
          </div>
          {cdmError && <p className="text-[11px] text-danger">{cdmError}</p>}
          {cdmPreview && (
            <YouthCard
              youth={cdmPreview}
              action={
                <button
                  type="button"
                  onClick={() => { onChange(cdmPreview); reset(); }}
                  className="inline-flex h-7 items-center gap-1.5 rounded-md bg-primary px-3 text-[11px] font-bold text-primary-foreground hover:opacity-90"
                >
                  Select
                </button>
              }
            />
          )}
        </div>
      )}

      {/* Browse mode */}
      {mode === "browse" && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            <select
              value={bDeanery}
              onChange={(e) => { setBDeanery(e.target.value); setBParish(""); setBOutstation(""); }}
              className={selCls}
            >
              <option value="">All Deaneries</option>
              {deaneries.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
            <select
              value={bParish}
              onChange={(e) => { setBParish(e.target.value); setBOutstation(""); }}
              className={selCls}
              disabled={parishes.length === 0}
            >
              <option value="">All Parishes</option>
              {parishes.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
            <select
              value={bOutstation}
              onChange={(e) => setBOutstation(e.target.value)}
              className={selCls}
              disabled={outstations.length === 0}
            >
              <option value="">All Outstations</option>
              {outstations.map((o) => <option key={o.id} value={o.name}>{o.name}</option>)}
            </select>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-3" />
            <Input
              value={bSearch}
              onChange={(e) => setBSearch(e.target.value)}
              placeholder="Search name or CDM No."
              className="pl-8"
            />
          </div>

          <div className="max-h-52 divide-y divide-border/50 overflow-y-auto rounded-lg border border-border">
            {bSearch.trim().length < 2 ? (
              <p className="p-3 text-center text-[11px] text-text-3">
                Type a name or CDM No. to search
                {(bDeanery || bParish) ? " within the selected location" : ""}.
              </p>
            ) : bResults.length === 0 ? (
              <p className="p-3 text-center text-[11px] text-text-3">
                No youth found. Try widening filters or checking the spelling.
              </p>
            ) : (
              bResults.map((y) => (
                <button
                  key={y.id}
                  type="button"
                  onClick={() => onChange(y)}
                  className="block w-full px-3 py-2 text-left hover:bg-bg-2"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[12px] font-semibold text-text-1">{y.full_name}</span>
                    <span className="font-mono text-[10px] text-text-3">{y.cdm_id}</span>
                  </div>
                  <div className="flex gap-2 text-[10px] text-text-3">
                    {y.phone && <span className="font-mono">{y.phone}</span>}
                    {[y.outstation_name, y.parish_name, y.deanery_name].filter(Boolean).length > 0 && (
                      <span>{[y.outstation_name, y.parish_name, y.deanery_name].filter(Boolean).join(" · ")}</span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
