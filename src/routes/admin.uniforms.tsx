import { useState, useMemo, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MoreVertical, Eye, Pencil, Trash2 } from "lucide-react";
import { Topbar, TopbarButton, TopbarTab } from "@/components/admin/topbar";
import { Card, Kpi, Pill } from "@/components/admin/ui-bits";
import { RecordFormDialog, type FieldDef } from "@/components/admin/record-form-dialog";
import { ViewRecordDialog } from "@/components/admin/view-record-dialog";
import { DateRangeFilter, inDateRange, type DateRange } from "@/components/admin/date-range-filter";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ORGANIZATION } from "@/lib/mock-data";
import {
  createUniformSku, deleteUniformSku, listUniformSkus, updateUniformSku,
  type UniformSku, type UniformSkuInput, type UniformSkuUpdateInput,
} from "@/lib/db/uniforms";
import {
  createStockEntry, deleteStockEntry, listStockEntries,
  type StockEntry, type StockEntryInput,
} from "@/lib/db/uniform-stock-entries";
import {
  createUniformSale, deleteUniformSale, listUniformSales,
  markDelivered, recordPayment, updateUniformSale,
  type PaymentStatus, type UniformSale, type UniformSaleInput, type UniformSaleUpdateInput,
} from "@/lib/db/uniform-sales";

export const Route = createFileRoute("/admin/uniforms")({
  head: () => ({
    meta: [
      { title: "Uniforms — CDM Youth Office" },
      { name: "description", content: "Uniform stock, sales, delivery and payment tracking." },
    ],
  }),
  component: UniformsPage,
});

/* ── types ── */
type TabId       = "stock" | "sales" | "reports";
type SalesFilter = "all" | "pending" | "paid" | "unpaid";

/* ── constants ── */
const EMPTY_RANGE: DateRange = { from: undefined, to: undefined };
const parishOptions = ORGANIZATION.flatMap((d) => d.parishes.map((p) => p.name));

/* ── field definitions ── */
const skuAddFields: FieldDef[] = [
  { key: "name",      label: "Item Name",                required: true, placeholder: "e.g. T-Shirt — Green" },
  { key: "inStock",   label: "In Stock",                 type: "number", required: true, placeholder: "0" },
  { key: "onOrder",   label: "On Order (from supplier)", type: "number", placeholder: "0" },
  { key: "unitPrice", label: "Unit Price (KES)",         type: "number", placeholder: "e.g. 450" },
];

const skuEditFields: FieldDef[] = [
  { key: "name",      label: "Item Name",                required: true },
  { key: "inStock",   label: "In Stock",                 type: "number", required: true },
  { key: "onOrder",   label: "On Order (from supplier)", type: "number", required: true },
  { key: "unitPrice", label: "Unit Price (KES)",         type: "number" },
];

function buildEntryFields(skuNames: string[]): FieldDef[] {
  const items = skuNames.length > 0 ? skuNames : MOCK_STOCK.map((s) => s.name);
  return [
    { key: "item",      label: "Item / SKU",    type: "select", required: true, options: items },
    { key: "quantity",  label: "Qty Sewn",      type: "number", required: true, placeholder: "e.g. 50" },
    { key: "enteredAt", label: "Date (leave blank for today)", type: "date" },
    { key: "notes",     label: "Notes",         type: "textarea", full: true, placeholder: "Batch #, sizes breakdown…" },
  ];
}

function buildSaleFields(skuNames: string[]): FieldDef[] {
  const items = skuNames.length > 0 ? skuNames : MOCK_STOCK.map((s) => s.name);
  return [
    { key: "youthName", label: "Youth Name",       required: true, placeholder: "Full name" },
    { key: "parish",    label: "Parish",            type: "select", options: parishOptions },
    { key: "item",      label: "Item / SKU",        type: "select", required: true, options: items },
    { key: "quantity",  label: "Quantity",          type: "number", required: true, placeholder: "1" },
    { key: "unitPrice", label: "Unit Price (KES)",  type: "number", placeholder: "e.g. 450" },
    { key: "orderedAt", label: "Order Date",        type: "date" },
    { key: "notes",     label: "Notes",             type: "textarea", full: true },
  ];
}

function buildSaleEditFields(skuNames: string[]): FieldDef[] {
  return [
    ...buildSaleFields(skuNames),
    { key: "deliveredAt", label: "Delivery Date (blank = not yet delivered)", type: "date" },
  ];
}

/* ── helpers ── */
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });

const fmtKES = (n: number) => `KES ${Math.round(n).toLocaleString()}`;

const payTone = (s: PaymentStatus): "success" | "gold" | "danger" =>
  s === "paid" ? "success" : s === "partial" ? "gold" : "danger";


function groupByItem(sales: UniformSale[]) {
  const m = new Map<string, { qty: number; revenue: number; collected: number }>();
  for (const s of sales) {
    const e = m.get(s.item_name) ?? { qty: 0, revenue: 0, collected: 0 };
    m.set(s.item_name, { qty: e.qty + s.quantity, revenue: e.revenue + s.quantity * Number(s.unit_price), collected: e.collected + Number(s.paid_amount) });
  }
  return Array.from(m.entries()).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue);
}

function groupByDay(sales: UniformSale[]) {
  const m = new Map<string, { qty: number; revenue: number }>();
  for (const s of sales) {
    const key = fmtDate(s.ordered_at);
    const e   = m.get(key) ?? { qty: 0, revenue: 0 };
    m.set(key, { qty: e.qty + s.quantity, revenue: e.revenue + s.quantity * Number(s.unit_price) });
  }
  return Array.from(m.entries()).map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 30);
}

const skuToInitial = (s: UniformSku): Record<string, string> => ({
  name: s.name, inStock: String(s.in_stock), onOrder: String(s.on_order),
  unitPrice: s.unit_price != null ? String(s.unit_price) : "",
});

const saleToInitial = (s: UniformSale): Record<string, string> => ({
  youthName: s.youth_name, parish: s.parish_name ?? "", item: s.item_name,
  quantity: String(s.quantity), unitPrice: String(s.unit_price),
  orderedAt: s.ordered_at ? s.ordered_at.split("T")[0] : "",
  deliveredAt: s.delivered_at ? s.delivered_at.split("T")[0] : "",
  notes: s.notes ?? "",
});

/* ── main component ── */

function UniformsPage() {
  const [tab,          setTab]          = useState<TabId>("stock");
  const [stockRange,   setStockRange]   = useState<DateRange>(EMPTY_RANGE);
  const [salesRange,   setSalesRange]   = useState<DateRange>(EMPTY_RANGE);
  const [reportRange,  setReportRange]  = useState<DateRange>(EMPTY_RANGE);
  const [salesFilter,  setSalesFilter]  = useState<SalesFilter>("all");

  /* ── SKU dialogs ── */
  const [addSkuOpen, setAddSkuOpen] = useState(false);
  const [editSku,    setEditSku]    = useState<{ id: string; initial: Record<string, string> } | null>(null);
  const [viewSku,    setViewSku]    = useState<UniformSku | null>(null);
  const [deleteSku,  setDeleteSku]  = useState<{ id: string; name: string } | null>(null);

  /* ── stock entry dialogs ── */
  const [addEntryOpen,  setAddEntryOpen]  = useState(false);
  const [deleteEntry,   setDeleteEntry]   = useState<{ id: string; name: string } | null>(null);

  /* ── sale dialogs ── */
  const [saleOpen,   setSaleOpen]   = useState(false);
  const [editSale,   setEditSale]   = useState<{ id: string; initial: Record<string, string> } | null>(null);
  const [viewSale,   setViewSale]   = useState<UniformSale | null>(null);
  const [deleteSale, setDeleteSale] = useState<{ id: string; name: string } | null>(null);
  const [paySale,    setPaySale]    = useState<UniformSale | null>(null);

  const qc = useQueryClient();

  /* ── queries ── */
  const { data: skusRaw    } = useQuery({ queryKey: ["uniform-skus"],    queryFn: listUniformSkus });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: entriesRaw } = useQuery({ queryKey: ["uniform-entries"],  queryFn: listStockEntries as any });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: salesRaw   } = useQuery({ queryKey: ["uniform-sales"],   queryFn: listUniformSales as any });

  const skus    = (skusRaw    ?? []) as UniformSku[];
  const entries = (entriesRaw ?? []) as StockEntry[];
  const sales   = (salesRaw   ?? []) as UniformSale[];

  const isLiveSkus    = skus.length    > 0;
  const isLiveEntries = entries.length > 0;
  const isLiveSales   = sales.length   > 0;

  const displaySkus    = isLiveSkus    ? skus    : MOCK_STOCK;
  const displayEntries = isLiveEntries ? entries : MOCK_ENTRIES;
  const displaySales   = isLiveSales   ? sales   : MOCK_SALES;
  const skuNames       = displaySkus.map((s) => s.name);

  /* ── derived ── */
  const filteredEntries = useMemo(
    () => displayEntries.filter((e) => inDateRange(e.entered_at, stockRange)),
    [displayEntries, stockRange],
  );

  const filteredSales = useMemo(() => {
    let s = displaySales.filter((x) => inDateRange(x.ordered_at, salesRange));
    if (salesFilter === "pending") s = s.filter((x) => !x.delivered_at);
    if (salesFilter === "paid")    s = s.filter((x) => x.payment_status === "paid");
    if (salesFilter === "unpaid")  s = s.filter((x) => x.payment_status !== "paid");
    return s;
  }, [displaySales, salesRange, salesFilter]);

  const stockKpis = useMemo(() => ({
    totalStock: displaySkus.reduce((a, u) => a + u.in_stock, 0),
    lowCount:   displaySkus.filter((u) => u.in_stock < 50).length,
    onOrder:    displaySkus.reduce((a, u) => a + u.on_order, 0),
    sewerYTD:   displayEntries.reduce((a, e) => a + e.quantity, 0),
  }), [displaySkus, displayEntries]);

  const salesKpis = useMemo(() => {
    const revenue     = displaySales.reduce((a, x) => a + x.quantity * Number(x.unit_price), 0);
    const collected   = displaySales.reduce((a, x) => a + Number(x.paid_amount), 0);
    return {
      total:       displaySales.length,
      pending:     displaySales.filter((x) => !x.delivered_at).length,
      delivered:   displaySales.filter((x) => !!x.delivered_at).length,
      outstanding: revenue - collected,
    };
  }, [displaySales]);

  const reportSales = useMemo(
    () => displaySales.filter((s) => inDateRange(s.ordered_at, reportRange)),
    [displaySales, reportRange],
  );
  const reportKpis  = useMemo(() => {
    const units     = reportSales.reduce((a, x) => a + x.quantity, 0);
    const revenue   = reportSales.reduce((a, x) => a + x.quantity * Number(x.unit_price), 0);
    const collected = reportSales.reduce((a, x) => a + Number(x.paid_amount), 0);
    return { units, revenue, collected, outstanding: revenue - collected };
  }, [reportSales]);

  const byItem = useMemo(() => groupByItem(reportSales), [reportSales]);
  const byDay  = useMemo(() => groupByDay(reportSales),  [reportSales]);

  /* ── mutations ── */
  const createSkuMut = useMutation({
    mutationFn: (i: UniformSkuInput) => createUniformSku(i),
    onSuccess: () => { toast.success("Item added."); qc.invalidateQueries({ queryKey: ["uniform-skus"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateSkuMut = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UniformSkuUpdateInput }) => updateUniformSku(id, input),
    onSuccess: () => { toast.success("Stock updated."); qc.invalidateQueries({ queryKey: ["uniform-skus"] }); setEditSku(null); },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteSkuMut = useMutation({
    mutationFn: (id: string) => deleteUniformSku(id),
    onSuccess: () => { toast.success("Item deleted."); qc.invalidateQueries({ queryKey: ["uniform-skus"] }); setDeleteSku(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const createEntryMut = useMutation({
    mutationFn: (i: StockEntryInput) => createStockEntry(i),
    onSuccess: () => {
      toast.success("Stock entry recorded.");
      qc.invalidateQueries({ queryKey: ["uniform-entries"] });
      qc.invalidateQueries({ queryKey: ["uniform-skus"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteEntryMut = useMutation({
    mutationFn: (id: string) => deleteStockEntry(id),
    onSuccess: () => { toast.success("Entry deleted."); qc.invalidateQueries({ queryKey: ["uniform-entries"] }); setDeleteEntry(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const createSaleMut = useMutation({
    mutationFn: (i: UniformSaleInput) => createUniformSale(i),
    onSuccess: () => { toast.success("Sale recorded."); qc.invalidateQueries({ queryKey: ["uniform-sales"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateSaleMut = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UniformSaleUpdateInput }) => updateUniformSale(id, input),
    onSuccess: () => { toast.success("Sale updated."); qc.invalidateQueries({ queryKey: ["uniform-sales"] }); setEditSale(null); },
    onError: (e: Error) => toast.error(e.message),
  });
  const deliverMut = useMutation({
    mutationFn: (id: string) => markDelivered(id),
    onSuccess: () => { toast.success("Marked as delivered."); qc.invalidateQueries({ queryKey: ["uniform-sales"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const payMut = useMutation({
    mutationFn: ({ id, total }: { id: string; total: number }) => recordPayment(id, total),
    onSuccess: () => { toast.success("Payment recorded."); qc.invalidateQueries({ queryKey: ["uniform-sales"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteSaleMut = useMutation({
    mutationFn: (id: string) => deleteUniformSale(id),
    onSuccess: () => { toast.success("Sale deleted."); qc.invalidateQueries({ queryKey: ["uniform-sales"] }); setDeleteSale(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  /* ── topbar action ── */
  const actionBtn =
    tab === "stock" ? (
      <div className="flex items-center gap-2">
        <button onClick={() => setAddSkuOpen(true)} className="text-[11px] font-semibold text-text-2 hover:text-text-1 transition-colors">
          + New Item
        </button>
        <TopbarButton onClick={() => setAddEntryOpen(true)}>+ Add Stock</TopbarButton>
      </div>
    ) : tab === "sales" ? (
      <TopbarButton onClick={() => setSaleOpen(true)}>+ Record Sale</TopbarButton>
    ) : null;

  /* ── TH helper ── */
  const TH = ({ children, className = "" }: { children?: React.ReactNode; className?: string }) => (
    <TableHead className={`h-8 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-text-3 ${className}`}>
      {children}
    </TableHead>
  );
  const TD = ({ children, className = "" }: { children?: React.ReactNode; className?: string }) => (
    <TableCell className={`px-3 py-2 text-[11px] ${className}`}>
      {children}
    </TableCell>
  );

  return (
    <>
      <Topbar
        title="Uniforms"
        tabs={
          <>
            <TopbarTab active={tab === "stock"}   onClick={() => setTab("stock")}>Stock</TopbarTab>
            <TopbarTab active={tab === "sales"}   onClick={() => setTab("sales")}>Sales & Orders</TopbarTab>
            <TopbarTab active={tab === "reports"} onClick={() => setTab("reports")}>Reports</TopbarTab>
          </>
        }
        action={actionBtn}
      />

      <div className="flex-1 overflow-y-auto px-5 py-4">

        {/* ══════════════════ STOCK TAB ══════════════════ */}
        {tab === "stock" && (
          <>
            {/* KPIs */}
            <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <Kpi label="In Store (Total)"  value={stockKpis.totalStock.toLocaleString()} trend={`${displaySkus.length} items`} tone="up" />
              <Kpi label="On Order"          value={stockKpis.onOrder.toLocaleString()}    trend="from supplier"                  tone="info" />
              <Kpi label="Sewn / Added (All)"value={stockKpis.sewerYTD.toLocaleString()}   trend={`${displayEntries.length} batches`} tone="up" />
              <Kpi label="Low Stock"         value={String(stockKpis.lowCount)}            trend="items below 50 units"           tone={stockKpis.lowCount > 0 ? "warn" : "up"} />
            </div>

            {/* Current inventory table */}
            <div className="mb-4 overflow-hidden rounded-xl border border-border bg-card">
              <div className="border-b border-border px-3.5 py-2.5">
                <div className="text-[11px] font-bold text-gold">Current Inventory</div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border bg-bg-3 hover:bg-bg-3">
                    <TH>Item</TH>
                    <TH className="text-right">In Store</TH>
                    <TH className="text-right">On Order</TH>
                    <TH className="text-right">Unit Price</TH>
                    <TH>Status</TH>
                    {isLiveSkus && <TH className="w-10" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displaySkus.map((u) => (
                    <TableRow key={u.name} className="border-b border-border hover:bg-bg-2">
                      <TD>
                        <div className="flex items-center gap-2">
                          <div className="h-5 w-5 shrink-0 rounded border border-border" style={{ background: u.swatch ?? "var(--color-bg-4)" }} />
                          <span className="font-semibold text-foreground">{u.name}</span>
                        </div>
                      </TD>
                      <TD className="text-right font-semibold text-foreground">{u.in_stock.toLocaleString()}</TD>
                      <TD className="text-right text-text-2">{u.on_order.toLocaleString()}</TD>
                      <TD className="text-right text-text-2">{u.unit_price != null ? fmtKES(u.unit_price) : "—"}</TD>
                      <TD>
                        <Pill tone={u.in_stock < 50 ? "danger" : u.in_stock < 200 ? "gold" : "success"}>
                          {u.in_stock < 50 ? "critical" : u.in_stock < 200 ? "low" : "ok"}
                        </Pill>
                      </TD>
                      {isLiveSkus && (
                        <TD>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="rounded p-1 hover:bg-bg-3">
                                <MoreVertical className="h-3.5 w-3.5 text-text-3" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-[140px]">
                              <DropdownMenuItem onClick={() => setViewSku(u as UniformSku)}>
                                <Eye className="mr-2 h-3.5 w-3.5" /> View
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setEditSku({ id: (u as UniformSku).id, initial: skuToInitial(u as UniformSku) })}>
                                <Pencil className="mr-2 h-3.5 w-3.5" /> Adjust Stock
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-danger focus:text-danger" onClick={() => setDeleteSku({ id: (u as UniformSku).id, name: u.name })}>
                                <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TD>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Stock log table */}
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
                <div className="text-[11px] font-bold text-gold">Stock Log — Sewing / Production</div>
                <div className="flex items-center gap-2">
                  <DateRangeFilter value={stockRange} onChange={setStockRange} />
                  <span className="text-[9px] font-bold text-text-4">{filteredEntries.length} record{filteredEntries.length !== 1 ? "s" : ""}</span>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border bg-bg-3 hover:bg-bg-3">
                    <TH>Date</TH>
                    <TH>Item</TH>
                    <TH className="text-right">Qty Sewn</TH>
                    <TH>Notes</TH>
                    {isLiveEntries && <TH className="w-10" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-6 text-center text-[11px] text-text-3">
                        No stock entries for this period.
                      </TableCell>
                    </TableRow>
                  ) : filteredEntries.map((e) => (
                    <TableRow key={e.id} className="border-b border-border hover:bg-bg-2">
                      <TD className="whitespace-nowrap text-text-2">{fmtDate(e.entered_at)}</TD>
                      <TD className="font-semibold text-foreground">{e.item_name}</TD>
                      <TD className="text-right font-bold text-foreground">{e.quantity.toLocaleString()}</TD>
                      <TD className="max-w-[200px] truncate text-text-3">{e.notes ?? "—"}</TD>
                      {isLiveEntries && (
                        <TD>
                          <button
                            onClick={() => setDeleteEntry({ id: e.id, name: `${e.item_name} × ${e.quantity}` })}
                            className="rounded p-1 text-text-4 hover:text-danger transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </TD>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        {/* ══════════════════ SALES & ORDERS TAB ══════════════════ */}
        {tab === "sales" && (
          <>
            {/* KPIs */}
            <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <Kpi label="Total Orders"      value={String(salesKpis.total)}              trend="all time"                tone="info" />
              <Kpi label="Awaiting Delivery" value={String(salesKpis.pending)}            trend="not yet handed over"     tone="warn" />
              <Kpi label="Delivered"         value={String(salesKpis.delivered)}          trend="handed to youth"         tone="up"   />
              <Kpi label="Outstanding"       value={fmtKES(salesKpis.outstanding)}        trend="not yet collected"       tone={salesKpis.outstanding > 0 ? "warn" : "up"} />
            </div>

            {/* Filter bar */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <DateRangeFilter value={salesRange} onChange={setSalesRange} />
              <div className="mx-1 h-4 w-px bg-border" />
              {(["all", "pending", "paid", "unpaid"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setSalesFilter(f)}
                  className={`rounded-full px-3 py-1 text-[10px] font-bold transition-colors ${
                    salesFilter === f ? "bg-danger text-white" : "bg-bg-3 text-text-2 hover:bg-bg-4"
                  }`}
                >
                  {f === "all" ? "All" : f === "pending" ? "Awaiting Delivery" : f === "paid" ? "Paid" : "Unpaid"}
                </button>
              ))}
              <span className="ml-auto text-[9px] font-bold text-text-4">
                {filteredSales.length} record{filteredSales.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Sales table */}
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border bg-bg-3 hover:bg-bg-3">
                    <TH>Date</TH>
                    <TH>Youth</TH>
                    <TH>Parish</TH>
                    <TH>Item</TH>
                    <TH className="text-right">Qty</TH>
                    <TH className="text-right">Total</TH>
                    <TH>Delivered</TH>
                    <TH>Payment</TH>
                    <TH className="w-28">Actions</TH>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSales.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="py-6 text-center text-[11px] text-text-3">
                        No sales for this filter.
                      </TableCell>
                    </TableRow>
                  ) : filteredSales.map((s) => {
                    const total       = s.quantity * Number(s.unit_price);
                    const outstanding = total - Number(s.paid_amount);
                    return (
                      <TableRow key={s.id} className="border-b border-border hover:bg-bg-2">
                        <TD className="whitespace-nowrap text-text-2">{fmtDate(s.ordered_at)}</TD>
                        <TD className="font-semibold text-foreground">{s.youth_name}</TD>
                        <TD className="text-text-2">{s.parish_name ?? "—"}</TD>
                        <TD className="text-text-2">{s.item_name}</TD>
                        <TD className="text-right text-foreground">{s.quantity}</TD>
                        <TD className="text-right font-semibold text-foreground">{fmtKES(total)}</TD>
                        <TD>
                          {s.delivered_at ? (
                            <span className="text-[10px] text-success font-semibold">{fmtDate(s.delivered_at)}</span>
                          ) : (
                            <Pill tone="neutral">pending</Pill>
                          )}
                        </TD>
                        <TD>
                          {s.payment_status === "paid" ? (
                            <span className="text-[10px] font-bold text-success">✓ {fmtKES(Number(s.paid_amount))}</span>
                          ) : s.payment_status === "partial" ? (
                            <span className="text-[10px] font-semibold text-gold">{fmtKES(Number(s.paid_amount))} / {fmtKES(total)}</span>
                          ) : (
                            <Pill tone="danger">unpaid</Pill>
                          )}
                        </TD>
                        <TD>
                          <div className="flex items-center gap-1">
                            {isLiveSales && !s.delivered_at && (
                              <button
                                onClick={() => deliverMut.mutate(s.id)}
                                className="rounded px-1.5 py-0.5 text-[9px] font-bold bg-info-soft text-info hover:opacity-80"
                              >
                                Deliver
                              </button>
                            )}
                            {isLiveSales && s.payment_status !== "paid" && (
                              <button
                                onClick={() => setPaySale(s)}
                                className="rounded px-1.5 py-0.5 text-[9px] font-bold bg-success-soft text-success hover:opacity-80"
                              >
                                {outstanding > 0 && Number(s.paid_amount) > 0 ? "Top Up" : "Pay"}
                              </button>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="rounded p-1 hover:bg-bg-3">
                                  <MoreVertical className="h-3.5 w-3.5 text-text-3" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="min-w-[140px]">
                                <DropdownMenuItem onClick={() => setViewSale(s)}>
                                  <Eye className="mr-2 h-3.5 w-3.5" /> View
                                </DropdownMenuItem>
                                {isLiveSales && (
                                  <DropdownMenuItem onClick={() => setEditSale({ id: s.id, initial: saleToInitial(s) })}>
                                    <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-danger focus:text-danger" onClick={() => setDeleteSale({ id: s.id, name: s.youth_name })}>
                                  <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TD>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        {/* ══════════════════ REPORTS TAB ══════════════════ */}
        {tab === "reports" && (
          <>
            <div className="mb-4 flex items-center gap-3">
              <DateRangeFilter value={reportRange} onChange={setReportRange} />
              {reportRange.from && (
                <span className="text-[9px] font-bold text-text-4">
                  {reportSales.length} sale{reportSales.length !== 1 ? "s" : ""} in range
                </span>
              )}
            </div>

            <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <Kpi label="Units Sold"  value={String(reportKpis.units)}       trend="uniforms" tone="up"   />
              <Kpi label="Revenue"     value={fmtKES(reportKpis.revenue)}     trend="expected" tone="info" />
              <Kpi label="Collected"   value={fmtKES(reportKpis.collected)}   trend="received" tone="up"   />
              <Kpi label="Outstanding" value={fmtKES(reportKpis.outstanding)} trend="not yet paid" tone={reportKpis.outstanding > 0 ? "warn" : "up"} />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Card>
                <div className="border-b border-border px-3.5 py-2.5">
                  <div className="text-[11px] font-bold text-gold">By Item</div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-border bg-bg-3 hover:bg-bg-3">
                      <TH>Item</TH>
                      <TH className="text-right">Units</TH>
                      <TH className="text-right">Revenue</TH>
                      <TH className="text-right">Owed</TH>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byItem.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="py-4 text-center text-[11px] text-text-3">No sales in this period.</TableCell></TableRow>
                    ) : byItem.map((row) => (
                      <TableRow key={row.name} className="border-b border-border hover:bg-bg-2">
                        <TD className="font-semibold text-foreground">{row.name}</TD>
                        <TD className="text-right text-text-2">{row.qty}</TD>
                        <TD className="text-right font-semibold text-foreground">{fmtKES(row.revenue)}</TD>
                        <TD className="text-right text-danger">
                          {row.revenue - row.collected > 0 ? fmtKES(row.revenue - row.collected) : "—"}
                        </TD>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>

              <Card>
                <div className="border-b border-border px-3.5 py-2.5">
                  <div className="text-[11px] font-bold text-gold">Daily Activity</div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-border bg-bg-3 hover:bg-bg-3">
                      <TH>Date</TH>
                      <TH className="text-right">Units</TH>
                      <TH className="text-right">Revenue</TH>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byDay.length === 0 ? (
                      <TableRow><TableCell colSpan={3} className="py-4 text-center text-[11px] text-text-3">No activity in this period.</TableCell></TableRow>
                    ) : byDay.map((row) => (
                      <TableRow key={row.date} className="border-b border-border hover:bg-bg-2">
                        <TD className="text-text-2">{row.date}</TD>
                        <TD className="text-right text-foreground">{row.qty}</TD>
                        <TD className="text-right font-semibold text-foreground">{fmtKES(row.revenue)}</TD>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </div>
          </>
        )}
      </div>

      {/* ══════════════════ DIALOGS ══════════════════ */}

      {/* Add SKU */}
      <RecordFormDialog open={addSkuOpen} onOpenChange={setAddSkuOpen} title="Add Uniform Item"
        fields={skuAddFields} submitLabel="Add Item"
        onSubmit={(v) => createSkuMut.mutate({ name: v.name, inStock: parseInt(v.inStock || "0", 10), onOrder: parseInt(v.onOrder || "0", 10), unitPrice: v.unitPrice ? parseFloat(v.unitPrice) : null })}
      />

      {/* Edit SKU */}
      <RecordFormDialog open={!!editSku} onOpenChange={(o) => { if (!o) setEditSku(null); }} title="Adjust Stock"
        fields={skuEditFields} initial={editSku?.initial} submitLabel="Update Stock"
        onSubmit={(v) => { if (!editSku) return; updateSkuMut.mutate({ id: editSku.id, input: { name: v.name, inStock: parseInt(v.inStock || "0", 10), onOrder: parseInt(v.onOrder || "0", 10), unitPrice: v.unitPrice ? parseFloat(v.unitPrice) : null } }); }}
      />

      {/* View SKU */}
      <ViewRecordDialog open={!!viewSku} onOpenChange={(o) => { if (!o) setViewSku(null); }} title={viewSku?.name ?? ""}
        fields={viewSku ? [
          { label: "Item Name",  value: viewSku.name },
          { label: "In Stock",   value: String(viewSku.in_stock) },
          { label: "On Order",   value: String(viewSku.on_order) },
          { label: "Unit Price", value: viewSku.unit_price != null ? fmtKES(viewSku.unit_price) : "—" },
          { label: "Status",     value: <Pill tone={viewSku.in_stock < 50 ? "danger" : viewSku.in_stock < 200 ? "gold" : "success"}>{viewSku.in_stock < 50 ? "Critical" : viewSku.in_stock < 200 ? "Low Stock" : "OK"}</Pill> },
        ] : []}
      />

      {/* Delete SKU */}
      <AlertDialog open={!!deleteSku} onOpenChange={(o) => { if (!o) setDeleteSku(null); }}>
        <AlertDialogContent className="border-border bg-white">
          <AlertDialogHeader><AlertDialogTitle>Delete "{deleteSku?.name}"?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-danger text-white hover:bg-danger/90" onClick={() => deleteSku && deleteSkuMut.mutate(deleteSku.id)}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Stock Entry */}
      <RecordFormDialog open={addEntryOpen} onOpenChange={setAddEntryOpen} title="Record Sewing Batch"
        description="Log uniforms sewn today. This updates the in-store count automatically."
        fields={buildEntryFields(skuNames)} submitLabel="Record Stock"
        onSubmit={(v) => createEntryMut.mutate({ itemName: v.item, quantity: parseInt(v.quantity || "0", 10), enteredAt: v.enteredAt || null, notes: v.notes || null })}
      />

      {/* Delete Stock Entry */}
      <AlertDialog open={!!deleteEntry} onOpenChange={(o) => { if (!o) setDeleteEntry(null); }}>
        <AlertDialogContent className="border-border bg-white">
          <AlertDialogHeader><AlertDialogTitle>Delete entry "{deleteEntry?.name}"?</AlertDialogTitle><AlertDialogDescription>This removes the log entry but does not adjust the stock count. This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-danger text-white hover:bg-danger/90" onClick={() => deleteEntry && deleteEntryMut.mutate(deleteEntry.id)}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Record Sale */}
      <RecordFormDialog open={saleOpen} onOpenChange={setSaleOpen} title="Record Sale"
        description="Record a uniform sale to a youth."
        fields={buildSaleFields(skuNames)} submitLabel="Record Sale"
        onSubmit={(v) => createSaleMut.mutate({ itemName: v.item, youthName: v.youthName, parishName: v.parish || null, quantity: parseInt(v.quantity || "1", 10), unitPrice: parseFloat(v.unitPrice || "0"), orderedAt: v.orderedAt || null, notes: v.notes || null })}
      />

      {/* Edit Sale */}
      <RecordFormDialog open={!!editSale} onOpenChange={(o) => { if (!o) setEditSale(null); }} title="Edit Sale"
        fields={buildSaleEditFields(skuNames)} initial={editSale?.initial} submitLabel="Save Changes"
        onSubmit={(v) => { if (!editSale) return; updateSaleMut.mutate({ id: editSale.id, input: { itemName: v.item, youthName: v.youthName, parishName: v.parish || null, quantity: parseInt(v.quantity || "1", 10), unitPrice: parseFloat(v.unitPrice || "0"), orderedAt: v.orderedAt || null, deliveredAt: v.deliveredAt || null, notes: v.notes || null } }); }}
      />

      {/* View Sale */}
      <ViewRecordDialog open={!!viewSale} onOpenChange={(o) => { if (!o) setViewSale(null); }}
        title={viewSale ? `${viewSale.youth_name} — ${viewSale.item_name}` : ""}
        fields={viewSale ? (() => {
          const total = viewSale.quantity * Number(viewSale.unit_price);
          const owed  = total - Number(viewSale.paid_amount);
          return [
            { label: "Youth Name",   value: viewSale.youth_name },
            { label: "Parish",       value: viewSale.parish_name ?? "—" },
            { label: "Item",         value: viewSale.item_name },
            { label: "Quantity",     value: String(viewSale.quantity) },
            { label: "Unit Price",   value: fmtKES(viewSale.unit_price) },
            { label: "Total Amount", value: fmtKES(total) },
            { label: "Payment",      value: <Pill tone={payTone(viewSale.payment_status)}>{viewSale.payment_status}</Pill> },
            { label: "Paid",         value: fmtKES(viewSale.paid_amount) },
            { label: "Outstanding",  value: owed > 0 ? fmtKES(owed) : "Fully paid" },
            { label: "Ordered",      value: fmtDate(viewSale.ordered_at) },
            { label: "Delivered",    value: viewSale.delivered_at ? fmtDate(viewSale.delivered_at) : "Not yet delivered" },
            { label: "Paid At",      value: viewSale.paid_at ? fmtDate(viewSale.paid_at) : "—" },
            { label: "Notes",        value: viewSale.notes ?? "—", full: true },
          ];
        })() : []}
      />

      {/* Delete Sale */}
      <AlertDialog open={!!deleteSale} onOpenChange={(o) => { if (!o) setDeleteSale(null); }}>
        <AlertDialogContent className="border-border bg-white">
          <AlertDialogHeader><AlertDialogTitle>Delete sale for "{deleteSale?.name}"?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-danger text-white hover:bg-danger/90" onClick={() => deleteSale && deleteSaleMut.mutate(deleteSale.id)}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Payment dialog */}
      <PaymentDialog sale={paySale} onClose={() => setPaySale(null)}
        onConfirm={(id, total) => { payMut.mutate({ id, total }); setPaySale(null); }}
      />
    </>
  );
}

/* ── payment dialog ── */

function PaymentDialog({
  sale, onClose, onConfirm,
}: { sale: UniformSale | null; onClose: () => void; onConfirm: (id: string, totalPaid: number) => void }) {
  const [amount, setAmount] = useState("");
  useEffect(() => { if (sale) setAmount(""); }, [sale]);
  if (!sale) return null;

  const total       = sale.quantity * Number(sale.unit_price);
  const alreadyPaid = Number(sale.paid_amount);
  const remaining   = total - alreadyPaid;

  return (
    <Dialog open={!!sale} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm border-border bg-white text-foreground">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-gold">Record Payment</DialogTitle>
          <DialogDescription>{sale.youth_name} — {sale.item_name} × {sale.quantity}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-bg-2 p-3 text-[11px] space-y-1.5">
            <div className="flex justify-between"><span className="text-text-3">Total Due</span><span className="font-bold">{fmtKES(total)}</span></div>
            {alreadyPaid > 0 && <div className="flex justify-between"><span className="text-text-3">Already Paid</span><span className="font-semibold text-success">{fmtKES(alreadyPaid)}</span></div>}
            <div className="flex justify-between border-t border-border pt-1.5"><span className="font-semibold text-text-2">Outstanding</span><span className="font-bold text-danger">{fmtKES(remaining)}</span></div>
          </div>
          <label className="block space-y-1 text-[10px] font-bold uppercase tracking-wide text-text-3">
            <span>Amount Received (KES)</span>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={String(remaining)} className="mt-1" />
          </label>
        </div>
        <DialogFooter>
          <button onClick={onClose} className="rounded-lg border border-border bg-bg-3 px-3 py-2 text-[11px] font-bold text-text-2">Cancel</button>
          <button onClick={() => { const amt = parseFloat(amount || "0"); if (!amt || amt <= 0) { toast.error("Enter a valid amount"); return; } onConfirm(sale.id, alreadyPaid + amt); }} className="rounded-lg bg-primary px-4 py-2 text-[11px] font-bold text-primary-foreground hover:opacity-90">Record Payment</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── mock data ── */

const MOCK_STOCK = [
  { id: "", name: "T-Shirt — Green",     swatch: "var(--color-success)", in_stock: 480, on_order: 200, unit_price: 450, created_at: "", updated_at: "" },
  { id: "", name: "T-Shirt — Gold",      swatch: "var(--color-gold)",    in_stock: 120, on_order: 350, unit_price: 450, created_at: "", updated_at: "" },
  { id: "", name: "Cap — Embroidered",   swatch: "var(--color-bg-4)",    in_stock: 240, on_order: 100, unit_price: 350, created_at: "", updated_at: "" },
  { id: "", name: "Sash — Mission Week", swatch: "var(--color-danger)",  in_stock:  60, on_order: 180, unit_price: 250, created_at: "", updated_at: "" },
];

const MOCK_ENTRIES: StockEntry[] = [
  { id: "e1", sku_id: null, item_name: "T-Shirt — Green",     quantity: 50, notes: "Batch #3 — S×20 M×20 L×10", entered_at: "2026-06-19T09:00:00Z", created_at: "2026-06-19T09:00:00Z" },
  { id: "e2", sku_id: null, item_name: "T-Shirt — Gold",      quantity: 30, notes: "Batch #2",                   entered_at: "2026-06-18T10:00:00Z", created_at: "2026-06-18T10:00:00Z" },
  { id: "e3", sku_id: null, item_name: "Cap — Embroidered",   quantity: 20, notes: null,                         entered_at: "2026-06-17T11:00:00Z", created_at: "2026-06-17T11:00:00Z" },
  { id: "e4", sku_id: null, item_name: "T-Shirt — Green",     quantity: 100, notes: "Initial batch",             entered_at: "2026-06-01T08:00:00Z", created_at: "2026-06-01T08:00:00Z" },
  { id: "e5", sku_id: null, item_name: "Sash — Mission Week", quantity: 60, notes: "Mission week batch",         entered_at: "2026-06-05T08:00:00Z", created_at: "2026-06-05T08:00:00Z" },
];

const MOCK_SALES: UniformSale[] = [
  { id: "m1", sku_id: null, item_name: "T-Shirt — Green",     youth_name: "John Kamau",   parish_name: "Kagio",    quantity: 1, unit_price: 450, ordered_at: "2026-06-15T09:00:00Z", delivered_at: "2026-06-17T14:00:00Z", paid_at: "2026-06-17T14:00:00Z", paid_amount: 450, payment_status: "paid",    notes: null, created_at: "2026-06-15T09:00:00Z", updated_at: "2026-06-17T14:00:00Z" },
  { id: "m2", sku_id: null, item_name: "T-Shirt — Gold",      youth_name: "Mary Wanjiku", parish_name: "Maragwā",  quantity: 1, unit_price: 450, ordered_at: "2026-06-16T10:00:00Z", delivered_at: null,                  paid_at: null,                   paid_amount: 0,   payment_status: "unpaid",  notes: null, created_at: "2026-06-16T10:00:00Z", updated_at: "2026-06-16T10:00:00Z" },
  { id: "m3", sku_id: null, item_name: "Cap — Embroidered",   youth_name: "Peter Otieno", parish_name: "Kangari",  quantity: 2, unit_price: 350, ordered_at: "2026-06-17T11:00:00Z", delivered_at: "2026-06-19T09:00:00Z", paid_at: null,                   paid_amount: 350, payment_status: "partial", notes: null, created_at: "2026-06-17T11:00:00Z", updated_at: "2026-06-19T09:00:00Z" },
  { id: "m4", sku_id: null, item_name: "T-Shirt — Green",     youth_name: "Grace Njoki",  parish_name: "Kiria-Ini",quantity: 1, unit_price: 450, ordered_at: "2026-06-18T08:00:00Z", delivered_at: null,                  paid_at: null,                   paid_amount: 0,   payment_status: "unpaid",  notes: null, created_at: "2026-06-18T08:00:00Z", updated_at: "2026-06-18T08:00:00Z" },
  { id: "m5", sku_id: null, item_name: "Sash — Mission Week", youth_name: "James Mutua",  parish_name: "Kagio",    quantity: 1, unit_price: 250, ordered_at: "2026-06-19T07:00:00Z", delivered_at: "2026-06-19T12:00:00Z", paid_at: "2026-06-19T12:00:00Z",  paid_amount: 250, payment_status: "paid",    notes: null, created_at: "2026-06-19T07:00:00Z", updated_at: "2026-06-19T12:00:00Z" },
];
