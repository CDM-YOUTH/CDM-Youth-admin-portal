import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export type FieldDef = {
  key: string;
  label: string;
  type?: "text" | "number" | "email" | "tel" | "date" | "textarea" | "select";
  options?: string[];
  placeholder?: string;
  required?: boolean;
  /** When set, value is auto-derived from another field's value */
  derivedFrom?: string;
  /** Optional dynamic options resolver: (values) => string[] */
  dynamicOptions?: (values: Record<string, string>) => string[];
  /** Width hint */
  full?: boolean;
};

export function RecordFormDialog({
  open,
  onOpenChange,
  title,
  description,
  fields,
  initial,
  submitLabel = "Save",
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  fields: FieldDef[];
  initial?: Record<string, string>;
  submitLabel?: string;
  onSubmit: (values: Record<string, string>) => void;
}) {
  const initialValues = useMemo(() => {
    const v: Record<string, string> = {};
    fields.forEach((f) => (v[f.key] = initial?.[f.key] ?? ""));
    return v;
  }, [fields, initial]);

  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (open) {
      setValues(initialValues);
      setErrors({});
    }
  }, [open, initialValues]);

  const setField = (key: string, value: string) => {
    setValues((prev) => {
      const next = { ...prev, [key]: value };
      // reset dependent fields when parent changes
      fields.forEach((f) => {
        if (f.dynamicOptions && f.dynamicOptions !== undefined) {
          // reset child field if it's no longer valid
          const opts = f.dynamicOptions(next);
          if (next[f.key] && !opts.includes(next[f.key])) next[f.key] = "";
        }
      });
      return next;
    });
  };

  const handleSubmit = () => {
    const errs: Record<string, boolean> = {};
    fields.forEach((f) => {
      if (f.required && !values[f.key]?.toString().trim()) errs[f.key] = true;
    });
    if (Object.keys(errs).length) {
      setErrors(errs);
      toast.error("Please fill in the required fields");
      return;
    }
    onSubmit(values);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="text-display text-xl font-black">{title}</DialogTitle>
          {description && <DialogDescription className="text-[12px] text-text-3">{description}</DialogDescription>}
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map((f) => {
            const val = values[f.key] ?? "";
            const opts = f.dynamicOptions ? f.dynamicOptions(values) : f.options;
            const isErr = errors[f.key];
            const wrapperClass = `space-y-1 text-[10px] font-bold uppercase tracking-wide ${isErr ? "text-danger" : "text-text-3"} ${f.full || f.type === "textarea" ? "sm:col-span-2" : ""}`;
            return (
              <label key={f.key} className={wrapperClass}>
                <span>{f.label}{f.required ? " *" : ""}</span>
                {renderField(f, val, (v) => setField(f.key, v), opts)}
              </label>
            );
          })}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg border border-border bg-bg-3 px-3 py-2 text-[11px] font-bold text-text-2"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="rounded-lg bg-gold px-4 py-2 text-[11px] font-bold text-gold-foreground hover:opacity-90"
          >
            {submitLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function renderField(
  field: FieldDef,
  value: string,
  onChange: (v: string) => void,
  options?: string[],
) {
  if (field.type === "textarea") {
    return <Textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder ?? field.label} />;
  }
  if (field.type === "select") {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder={field.placeholder ?? `Select ${field.label.toLowerCase()}`} /></SelectTrigger>
        <SelectContent>
          {(options ?? []).map((opt) => (
            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  return (
    <Input
      type={field.type ?? "text"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder ?? field.label}
    />
  );
}
