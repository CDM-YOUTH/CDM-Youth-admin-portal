import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { OrgTree } from "@/lib/db/org";
import type { ParishAssessment } from "@/lib/db/finances";

export type RecordPaymentInput = {
  parishId: string;
  amountPaid: string;
  paymentMethod: "cheque" | "bank_deposit" | "cash";
  referenceNumber?: string;
  paymentDate: string;
  notes?: string;
  allocations: Array<{
    assessmentId: string;
    allocatedAmount: string;
  }>;
};

export function RecordPaymentDialog({
  open,
  onOpenChange,
  org,
  assessments = [],
  isPending = false,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  org?: OrgTree;
  assessments?: ParishAssessment[];
  isPending?: boolean;
  onSubmit: (input: RecordPaymentInput) => void;
}) {
  const [parishId, setParishId] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cheque" | "bank_deposit" | "cash">("cheque");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [autoAllocate, setAutoAllocate] = useState(true);
  const [targetAssessmentId, setTargetAssessmentId] = useState("");

  // Filter assessments for selected parish
  const parishAssessments = useMemo(() => {
    if (!parishId) return [];
    return assessments.filter((a) => a.parish_id === parishId);
  }, [parishId, assessments]);

  const handleSubmit = () => {
    if (!parishId) {
      toast.error("Please select a parish");
      return;
    }

    const amount = parseFloat(amountPaid);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid payment amount");
      return;
    }

    if (!paymentDate) {
      toast.error("Select a payment date");
      return;
    }

    if (paymentMethod === "cheque" && !referenceNumber.trim()) {
      toast.error("Enter a cheque number");
      return;
    }

    if (!autoAllocate && !targetAssessmentId) {
      toast.error("Select a category to allocate to");
      return;
    }

    let allocations: Array<{ assessmentId: string; allocatedAmount: string }> = [];

    if (autoAllocate) {
      // FIFO waterfall allocation: oldest arrears first
      let remaining = amount;
      const sorted = [...parishAssessments].sort((a, b) => {
        if (a.is_historical_arrears !== b.is_historical_arrears) {
          return a.is_historical_arrears ? -1 : 1;
        }
        return a.fiscal_year - b.fiscal_year;
      });

      for (const assessment of sorted) {
        if (remaining <= 0) break;
        const due = parseFloat(assessment.amount_due);
        const allocate = Math.min(remaining, due);
        allocations.push({
          assessmentId: assessment.id,
          allocatedAmount: allocate.toFixed(2),
        });
        remaining -= allocate;
      }
    } else {
      allocations = [
        {
          assessmentId: targetAssessmentId,
          allocatedAmount: amount.toFixed(2),
        },
      ];
    }

    onSubmit({
      parishId,
      amountPaid: amount.toFixed(2),
      paymentMethod,
      referenceNumber: referenceNumber.trim() || undefined,
      paymentDate,
      notes: notes.trim() || undefined,
      allocations,
    });

    // Reset form
    setParishId("");
    setAmountPaid("");
    setPaymentMethod("cheque");
    setReferenceNumber("");
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setNotes("");
    setAutoAllocate(true);
    setTargetAssessmentId("");
  };

  // All parishes in org
  const allParishes = (org?.parishes ?? []).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-border bg-white text-foreground">
        <DialogHeader>
          <DialogTitle className="text-display text-xl font-black text-gold">
            Record Parish Payment
          </DialogTitle>
          <DialogDescription className="text-[12px] text-text-3">
            Log a new payment and automatically allocate to outstanding obligations.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-96 overflow-y-auto">
          {/* Parish Selection */}
          <label className="block space-y-1 text-[10px] font-bold uppercase tracking-wide text-text-3">
            <span>Select Parish / Deanery *</span>
            <Select value={parishId} onValueChange={setParishId}>
              <SelectTrigger>
                <SelectValue placeholder="Select parish" />
              </SelectTrigger>
              <SelectContent>
                {allParishes.map((parish) => (
                  <SelectItem key={parish.id} value={parish.id}>
                    {parish.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          {/* Payment Method */}
          <label className="block space-y-2 text-[10px] font-bold uppercase tracking-wide text-text-3">
            <span>Payment Method *</span>
            <RadioGroup
              value={paymentMethod}
              onValueChange={(v) => setPaymentMethod(v as "cheque" | "bank_deposit" | "cash")}
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="cheque" id="cheque" />
                <label htmlFor="cheque" className="text-[11px] font-semibold">
                  Cheque
                </label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="bank_deposit" id="bank_deposit" />
                <label htmlFor="bank_deposit" className="text-[11px] font-semibold">
                  Bank Deposit
                </label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="cash" id="cash" />
                <label htmlFor="cash" className="text-[11px] font-semibold">
                  Cash
                </label>
              </div>
            </RadioGroup>
          </label>

          {/* Reference Number / Cheque Code */}
          <label className="block space-y-1 text-[10px] font-bold uppercase tracking-wide text-text-3">
            <span>Reference Number {paymentMethod === "cheque" ? "*" : ""}</span>
            <Input
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder={
                paymentMethod === "cheque"
                  ? "e.g. CHQ-992811"
                  : "e.g. DEP-20261001 or bank slip code"
              }
            />
          </label>

          {/* Amount Paid */}
          <label className="block space-y-1 text-[10px] font-bold uppercase tracking-wide text-text-3">
            <span>Amount Paid (KES) *</span>
            <Input
              type="number"
              inputMode="decimal"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              placeholder="e.g. 15,000"
              step="0.01"
            />
          </label>

          {/* Payment Date */}
          <label className="block space-y-1 text-[10px] font-bold uppercase tracking-wide text-text-3">
            <span>Payment Date *</span>
            <Input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
          </label>

          {/* Allocation Routing */}
          <label className="block space-y-2 text-[10px] font-bold uppercase tracking-wide text-text-3">
            <span>Allocation Routing *</span>
            <RadioGroup value={autoAllocate ? "auto" : "manual"}>
              <div className="flex items-start gap-2">
                <RadioGroupItem
                  value="auto"
                  id="auto"
                  onClick={() => setAutoAllocate(true)}
                  className="mt-1"
                />
                <label htmlFor="auto" className="flex-1 cursor-pointer">
                  <div className="text-[11px] font-semibold">
                    Auto-apply to oldest arrears (Waterfall FIFO)
                  </div>
                  <div className="text-[10px] text-text-4">
                    Payment allocated automatically to oldest historical arrears, then current
                    period obligations
                  </div>
                </label>
              </div>
              <div className="flex items-start gap-2">
                <RadioGroupItem
                  value="manual"
                  id="manual"
                  onClick={() => setAutoAllocate(false)}
                  className="mt-1"
                />
                <label htmlFor="manual" className="flex-1 cursor-pointer">
                  <div className="text-[11px] font-semibold">Manually target specific category</div>
                  <div className="text-[10px] text-text-4">
                    Apply entire payment to one selected obligation
                  </div>
                </label>
              </div>
            </RadioGroup>

            {!autoAllocate && parishAssessments.length > 0 && (
              <Select value={targetAssessmentId} onValueChange={setTargetAssessmentId}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select category / debt" />
                </SelectTrigger>
                <SelectContent>
                  {parishAssessments.map((assessment) => (
                    <SelectItem key={assessment.id} value={assessment.id}>
                      {assessment.category?.name} ({assessment.fiscal_year})
                      {assessment.is_historical_arrears ? " — ARREARS" : ""} (Due: KES{" "}
                      {parseFloat(assessment.amount_due).toLocaleString()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </label>

          {/* Notes */}
          <label className="block space-y-1 text-[10px] font-bold uppercase tracking-wide text-text-3">
            <span>Notes (optional)</span>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any relevant notes about this payment (e.g. partial payment, special collection)"
              rows={2}
            />
          </label>
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
            disabled={isPending}
            className="rounded-lg bg-primary px-4 py-2 text-[11px] font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {isPending ? "Saving…" : "Save & Post Payment"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
