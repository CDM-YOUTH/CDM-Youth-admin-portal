import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Loader2, X } from "lucide-react";

export type FieldDef = {
  key: string;
  label: string;
  type?: "text" | "number" | "email" | "tel" | "date" | "textarea" | "select" | "image" | "file";
  options?: string[];
  placeholder?: string;
  required?: boolean;
  /** When set, value is auto-derived from another field's value */
  derivedFrom?: string;
  /** Optional dynamic options resolver: (values) => string[] */
  dynamicOptions?: (values: Record<string, string>) => string[];
  /** Width hint */
  full?: boolean;
  /** For type="image"/"file": storage bucket name */
  bucket?: string;
  /** For type="file": accept attribute + max size in MB (defaults to 20MB, any type) */
  accept?: string;
  maxSizeMb?: number;
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
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto border-border bg-white text-foreground">
        <DialogHeader>
          <DialogTitle className="text-display text-xl font-black text-gold">{title}</DialogTitle>
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
            className="rounded-lg bg-primary px-4 py-2 text-[11px] font-bold text-primary-foreground hover:opacity-90"
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
  if (field.type === "image") {
    return <ImageUpload value={value} onChange={onChange} bucket={field.bucket ?? "passports"} />;
  }
  if (field.type === "file") {
    return (
      <FileUpload
        value={value}
        onChange={onChange}
        bucket={field.bucket ?? "formation"}
        accept={field.accept}
        maxSizeMb={field.maxSizeMb ?? 20}
      />
    );
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

function ImageUpload({ value, onChange, bucket }: { value: string; onChange: (v: string) => void; bucket: string }) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });
      if (error) throw error;
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      onChange(data.publicUrl);
      toast.success("Photo uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-bg-2 p-2 normal-case tracking-normal">
      {value ? (
        <img src={value} alt="Passport" className="h-16 w-16 rounded-md border border-border object-cover" />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-md border border-dashed border-border bg-bg-3 text-text-4">
          <Upload className="h-5 w-5" />
        </div>
      )}
      <div className="flex flex-1 flex-col gap-1.5">
        <label className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-md border border-border bg-bg-3 px-2.5 py-1.5 text-[11px] font-bold text-text-1 hover:bg-bg-4">
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {uploading ? "Uploading…" : value ? "Replace photo" : "Choose passport photo"}
          <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="inline-flex w-fit items-center gap-1 text-[10px] font-semibold text-text-3 hover:text-danger"
          >
            <X className="h-3 w-3" /> Remove
          </button>
        )}
      </div>
    </div>
  );
}

function FileUpload({
  value,
  onChange,
  bucket,
  accept,
  maxSizeMb,
}: {
  value: string;
  onChange: (v: string) => void;
  bucket: string;
  accept?: string;
  maxSizeMb: number;
}) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > maxSizeMb * 1024 * 1024) {
      toast.error(`File must be under ${maxSizeMb}MB`);
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });
      if (error) throw error;
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      onChange(data.publicUrl);
      toast.success("File uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const fileName = value ? decodeURIComponent(value.split("/").pop() ?? value) : "";

  return (
    <div className="space-y-1.5 normal-case tracking-normal">
      {value && (
        <a
          href={value}
          target="_blank"
          rel="noreferrer"
          className="block truncate rounded-md border border-border bg-bg-2 px-2.5 py-1.5 text-[11px] text-primary underline"
        >
          {fileName}
        </a>
      )}
      <div className="flex items-center gap-2">
        <label className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-md border border-border bg-bg-3 px-2.5 py-1.5 text-[11px] font-bold text-text-1 hover:bg-bg-4">
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {uploading ? "Uploading…" : value ? "Replace file" : "Choose file"}
          <input type="file" accept={accept} className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="inline-flex items-center gap-1 text-[10px] font-semibold text-text-3 hover:text-danger"
          >
            <X className="h-3 w-3" /> Remove
          </button>
        )}
      </div>
    </div>
  );
}
