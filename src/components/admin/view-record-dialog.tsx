import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ReactNode } from "react";

export type ViewField = { label: string; value?: ReactNode; full?: boolean };

export function ViewRecordDialog({
  open,
  onOpenChange,
  title,
  fields,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  fields: ViewField[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-xl overflow-y-auto border-border bg-white text-foreground">
        <DialogHeader>
          <DialogTitle className="text-display text-xl font-black text-gold">{title}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
          {fields.map(({ label, value, full }) => (
            <div key={label} className={`space-y-1 ${full ? "sm:col-span-2" : ""}`}>
              <div className="text-[10px] font-bold uppercase tracking-wide text-text-3">{label}</div>
              <div className="min-h-[28px] rounded-md bg-bg-2 px-2.5 py-1.5 text-[12px] text-foreground">
                {value ?? <span className="italic text-text-4">—</span>}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
