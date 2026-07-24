import { useEffect, useState } from "react";
import { Link2, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

type YouthOption = { id: string; full_name: string; cdm_id: string };

/** Small search-and-link control — lets staff optionally link a duty
 * assignee (currently just a free-text name) to an actual portal member,
 * so the youth can see "your assigned duty" on the portal. */
export function YouthPicker({
  value,
  linkedName,
  onChange,
}: {
  value: string | null;
  linkedName?: string;
  onChange: (youth: YouthOption | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<YouthOption[]>([]);

  useEffect(() => {
    if (!open || search.trim().length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(async () => {
      const { data } = await supabase
        .from("youths")
        .select("id, full_name, cdm_id")
        .or(`full_name.ilike.%${search}%,cdm_id.ilike.%${search}%`)
        .limit(8);
      if (!cancelled) setResults(data ?? []);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [search, open]);

  if (value) {
    return (
      <button
        type="button"
        onClick={() => onChange(null)}
        className="flex shrink-0 items-center gap-1 rounded-md border border-success/40 bg-success-soft px-1.5 py-1 text-[9px] font-bold text-success"
        title="Unlink member"
      >
        <Link2 className="h-3 w-3" /> {linkedName ?? "Linked"} <X className="h-2.5 w-2.5" />
      </button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex shrink-0 items-center gap-1 rounded-md border border-dashed border-border px-1.5 py-1 text-[9px] font-bold text-text-3 hover:border-gold-3 hover:text-gold"
        >
          <Link2 className="h-3 w-3" /> Link member
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <Input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or CDM No."
          className="h-8 text-[11px]"
        />
        <div className="mt-1.5 max-h-48 space-y-0.5 overflow-y-auto">
          {search.trim().length < 2 ? (
            <p className="px-1 py-2 text-[10px] text-text-3">Type at least 2 characters…</p>
          ) : results.length === 0 ? (
            <p className="px-1 py-2 text-[10px] text-text-3">No members found.</p>
          ) : (
            results.map((y) => (
              <button
                key={y.id}
                type="button"
                onClick={() => {
                  onChange(y);
                  setOpen(false);
                  setSearch("");
                }}
                className="block w-full rounded px-2 py-1.5 text-left text-[11px] hover:bg-bg-2"
              >
                <span className="font-semibold text-text-1">{y.full_name}</span>{" "}
                <span className="text-text-3">{y.cdm_id}</span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
