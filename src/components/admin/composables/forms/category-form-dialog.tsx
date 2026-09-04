import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { IconColorPicker } from "../icon-color-picker";

export interface CategoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  submitLabel?: string;
  initial?: {
    name?: string;
    description?: string;
    icon?: string;
    color?: string;
  };
  onSubmit: (values: { name: string; description: string | null; icon: string | null; color: string | null }) => void;
  isLoading?: boolean;
}

export function CategoryFormDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel = "Save",
  initial,
  onSubmit,
  isLoading,
}: CategoryFormDialogProps) {
  const [name, setName] = useState(initial?.name || "");
  const [desc, setDesc] = useState(initial?.description || "");
  const [icon, setIcon] = useState(initial?.icon || "📁");
  const [color, setColor] = useState(initial?.color || "#1e40af");

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      description: desc.trim() || null,
      icon: icon || null,
      color: color || null,
    });
    setName("");
    setDesc("");
    setIcon("📁");
    setColor("#1e40af");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-1">Name *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Prayer & Spirituality"
              className="border-border"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-text-1">Description</label>
            <Textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="What does this category contain?"
              className="border-border"
              rows={2}
            />
          </div>

          <IconColorPicker
            selectedIcon={icon}
            selectedColor={color}
            onIconChange={setIcon}
            onColorChange={setColor}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || !name.trim()}>
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
