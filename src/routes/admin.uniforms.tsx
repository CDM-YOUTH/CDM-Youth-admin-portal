import { useState, useMemo, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MoreVertical, Eye, Pencil, Trash2, BadgeCheck, Truck, PackageCheck, Banknote, Download, BarChart3, TrendingUp, PieChart } from "lucide-react";
import { Topbar, TopbarButton, TopbarTab } from "@/components/admin/layout/topbar";
import { Card, Kpi, Pill } from "@/components/admin/composables/ui-bits";
import { RecordFormDialog, type FieldDef } from "@/components/admin/composables/forms/record-form-dialog";
import { ViewRecordDialog } from "@/components/admin/composables/forms/view-record-dialog";
import { DateRangeFilter, inDateRange, type DateRange } from "@/components/admin/composables/pickers/date-range-filter";
import { usePagination, TablePagination } from "@/components/admin/composables/tables/table-pagination";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import { Donut } from "@/components/admin/composables/donut";
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
  createUniformItem, deleteUniformItem, listUniformItemsWithStock, updateUniformItem,
  type UniformItem, type UniformItemWithStock, type UniformItemInput, type UniformItemUpdateInput,
} from "@/lib/db/assets/uniforms";
import {
  createStockEntry, deleteStockEntry, listStockEntries, listUniformActivities,
  type StockEntry, type StockEntryInput, type UniformActivity,
} from "@/lib/db/assets/uniform-stock-entries";
import {
  createUniformOrder, deleteUniformOrder, listUniformOrders, listUniformOrdersPaged,
  approveOrder, confirmDispatch, confirmDelivery, recordPayment, cancelOrder, updateUniformOrder,
  type PaymentStatus, type OrderStatus, type UniformOrder, type UniformOrderInput, type UniformOrderUpdateInput,
} from "@/lib/db/assets/uniform-sales";
import {
  fetchUniformSettings,
  type UniformSettings,
} from "@/lib/db/organization-settings";

export const Route = createFileRoute("/admin/uniforms")({
  head: () => ({
    meta: [
      { title: "Uniforms — CDM Youth Office" },
      { name: "description", content: "Uniform stock, sales, delivery and payment tracking." },
    ],
  }),
  component: UniformsPage,
});

function UniformsPage() {
  const [tab,          setTab]          = useState<TabId>("status");
  const [statusRange,  setStatusRange]  = useState<DateRange>(EMPTY_RANGE);
  const [stockInRange,  setStockInRange]  = useState<DateRange>(EMPTY_RANGE);
  const [stockOutRange, setStockOutRange] = useState<DateRange>(EMPTY_RANGE);
  const [reportRange,  setReportRange]  = useState<DateRange>(EMPTY_RANGE);
  const [reportItem,   setReportItem]   = useState<string>("all");
  const [statusQ,      setStatusQ]      = useState("");
  const [stockInQ,     setStockInQ]     = useState("");
  const [ordersFilter, setOrdersFilter] = useState<OrdersFilter>("all");
  const [ordersPage,   setOrdersPage]   = useState(1);
  const [ordersQ,      setOrdersQ]      = useState("");

  /* ── Item dialogs ── */
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [editItem,    setEditItem]    = useState<{ id: string; initial: Record<string, string> } | null>(null);
  const [viewItem,    setViewItem]    = useState<UniformItemWithStock | null>(null);
  const [deleteItem,  setDeleteItem]  = useState<{ id: string; name: string } | null>(null);

  /* ── Stock entry dialogs ── */
  const [addEntryOpen,  setAddEntryOpen]  = useState(false);
  const [deleteEntry,   setDeleteEntry]   = useState<{ id: string; name: string } | null>(null);

  /* ── Order dialogs ── */
  const [orderOpen,   setOrderOpen]   = useState(false);
  const [viewOrder,   setViewOrder]   = useState<UniformOrder | null>(null);
  const [deleteOrder, setDeleteOrder] = useState<{ id: string; name: string } | null>(null);
  const [payOrder,    setPayOrder]    = useState<UniformOrder | null>(null);
  const [dispatchOrder, setDispatchOrder] = useState<UniformOrder | null>(null);
  const [deliveryOrder, setDeliveryOrder] = useState<UniformOrder | null>(null);

  const qc = useQueryClient();

  /* ── organization settings ── */
  const { data: settings } = useQuery({
    queryKey: ["uniform-settings"],
    queryFn: fetchUniformSettings,
  });
  const uniformSettings: UniformSettings = settings || {
    lowStockThreshold: 50,
    mediumStockThreshold: 200,
    itemsPageSize: 10,
    entriesPageSize: 10,
    ordersPageSize: 10,
  };

  /* ── queries ── */
  const { data: itemsRaw    } = useQuery({ queryKey: ["uniform-items"],    queryFn: listUniformItemsWithStock });
  const { data: entriesRaw } = useQuery({ queryKey: ["uniform-entries"],  queryFn: listStockEntries });
  const { data: activitiesRaw } = useQuery({ queryKey: ["uniform-activities"], queryFn: listUniformActivities });
  // Full list for KPIs and reports tab
  const { data: ordersRaw   } = useQuery({ queryKey: ["uniform-orders"],   queryFn: listUniformOrders });
  // Paginated + filtered for the orders table
  const { data: ordersPagedResp } = useQuery({
    queryKey: ["uniform-orders-paged", ordersPage, uniformSettings.ordersPageSize, ordersQ, ordersFilter, stockOutRange.from?.toISOString(), stockOutRange.to?.toISOString()],
    queryFn: () =>
      listUniformOrdersPaged({
        page: ordersPage - 1,
        size: uniformSettings.ordersPageSize,
        q: ordersQ,
        status: ordersFilter === "pending" ? "pending" : ordersFilter === "all" ? null : ordersFilter,
        paymentStatus: null,
        from: stockOutRange.from?.toISOString().slice(0, 10) ?? null,
        to:   stockOutRange.to?.toISOString().slice(0, 10)   ?? null,
      }),
    placeholderData: keepPreviousData,
  });

  const items     = (itemsRaw     ?? []) as UniformItemWithStock[];
  const entries   = (entriesRaw   ?? []) as StockEntry[];
  const activities = (activitiesRaw ?? []) as UniformActivity[];
  const orders    = (ordersRaw    ?? []) as UniformOrder[];

  const displayItems     = items;
  const displayEntries   = entries;
  const displayOrders    = orders;
  const itemNames        = displayItems.map((s) => s.name);
  const activityNames    = activities.map((a) => a.name);

  // Server-paginated rows for the orders tab table
  const pagedOrderRows    = (ordersPagedResp?.data ?? []) as UniformOrder[];
  const pagedOrdersTotal  = ordersPagedResp?.total ?? 0;
  const pagedOrdersTotalPages = Math.max(1, Math.ceil(pagedOrdersTotal / uniformSettings.ordersPageSize));

  /* ── derived ── */
  const filteredEntries = useMemo(
    () => displayEntries.filter((e) => {
      const inDate = inDateRange(e.created_at, stockInRange);
      const matchesSearch = !stockInQ ||
        e.item_name.toLowerCase().includes(stockInQ.toLowerCase()) ||
        e.activity_name.toLowerCase().includes(stockInQ.toLowerCase()) ||
        (e.description?.toLowerCase().includes(stockInQ.toLowerCase()) ?? false);
      return inDate && matchesSearch;
    }),
    [displayEntries, stockInRange, stockInQ],
  );

  const filteredOrdersForStatus = useMemo(
    () => displayOrders.filter((o) => inDateRange(o.ordered_at, statusRange)),
    [displayOrders, statusRange],
  );

  const filteredItemsForStatus = useMemo(
    () => displayItems.filter((i) => !statusQ || i.name.toLowerCase().includes(statusQ.toLowerCase())),
    [displayItems, statusQ],
  );

  const itemPagination   = usePagination(filteredItemsForStatus, uniformSettings.itemsPageSize);
  const entryPagination = usePagination(filteredEntries, uniformSettings.entriesPageSize);

  const statusKpis = useMemo(() => ({
    totalStock: displayItems.reduce((a, u) => a + u.available_stock, 0),
    stockIn:    statusRange.from || statusRange.to ? filteredEntries.reduce((a, e) => a + e.quantity, 0) : displayItems.reduce((a, u) => a + u.stock_in, 0),
    stockOut:   statusRange.from || statusRange.to ? filteredOrdersForStatus.filter((o) => o.status === "delivered").reduce((a, o) => a + o.quantity, 0) : displayItems.reduce((a, u) => a + u.stock_out_delivered, 0),
    pending:    statusRange.from || statusRange.to ? filteredOrdersForStatus.filter((o) => o.status === "pending" || o.status === "approved").reduce((a, o) => a + o.quantity, 0) : displayItems.reduce((a, u) => a + u.pending_youth_orders, 0),
    lowCount:   displayItems.filter((u) => u.available_stock < uniformSettings.lowStockThreshold).length,
  }), [displayItems, filteredEntries, filteredOrdersForStatus, statusRange, uniformSettings.lowStockThreshold]);

  const stockInKpis = useMemo(() => ({
    totalEntries: filteredEntries.length,
    totalQty:     filteredEntries.reduce((a, e) => a + e.quantity, 0),
  }), [filteredEntries]);

  const stockInByItem = useMemo(() => {
    const m = new Map<string, { qty: number; entries: number; lastEntry: string }>();
    for (const e of displayEntries) {
      const existing = m.get(e.item_name) ?? { qty: 0, entries: 0, lastEntry: "" };
      m.set(e.item_name, {
        qty: existing.qty + e.quantity,
        entries: existing.entries + 1,
        lastEntry: existing.lastEntry ? (e.created_at > existing.lastEntry ? e.created_at : existing.lastEntry) : e.created_at,
      });
    }
    return Array.from(m.entries()).map(([name, v]) => ({ name, ...v }));
  }, [displayEntries]);

  const stockOutKpis = useMemo(() => {
    const hasFilters = stockOutRange.from || stockOutRange.to || ordersQ || ordersFilter !== "all";
    const ordersToUse = hasFilters ? pagedOrderRows : displayOrders;
    const revenue     = ordersToUse.reduce((a, x) => a + x.quantity * (x.unit_price ?? 0), 0);
    const collected   = ordersToUse.filter((x) => x.payment_status === "paid").length;
    return {
      total:       ordersToUse.length,
      pending:     ordersToUse.filter((x) => x.status === "pending").length,
      approved:    ordersToUse.filter((x) => x.status === "approved").length,
      paid:        ordersToUse.filter((x) => x.payment_status === "paid").length,
      dispatched:  ordersToUse.filter((x) => x.status === "dispatched").length,
      delivered:   ordersToUse.filter((x) => x.status === "delivered").length,
    };
  }, [pagedOrderRows, displayOrders, stockOutRange, ordersQ, ordersFilter]);

  const reportOrders = useMemo(
    () => displayOrders.filter((s) => inDateRange(s.ordered_at, reportRange)),
    [displayOrders, reportRange],
  );
  const reportKpis  = useMemo(() => {
    const units     = reportOrders.reduce((a, x) => a + x.quantity, 0);
    const revenue   = reportOrders.reduce((a, x) => a + x.quantity * (x.unit_price ?? 0), 0);
    const collected = reportOrders.filter((x) => x.payment_status === "paid").length;
    return { units, revenue, collected, pending: reportOrders.filter((x) => x.status !== "delivered").length };
  }, [reportOrders]);

  const byItem = useMemo(() => groupByItem(reportOrders), [reportOrders]);
  const byDay  = useMemo(() => groupByDay(reportOrders),  [reportOrders]);
  const byStatus = useMemo(() => {
    const totals: Record<OrderStatus, number> = { pending: 0, approved: 0, paid: 0, dispatched: 0, delivered: 0, cancelled: 0 };
    for (const s of reportOrders) totals[s.status] += 1;
    return totals;
  }, [reportOrders]);

  // Statistics for Reports tab (filtered by date and item)
  const statsOrders = useMemo(
    () => displayOrders.filter((s) => {
      const inDate = inDateRange(s.ordered_at, reportRange);
      const matchesItem = reportItem === "all" || s.item_name === reportItem;
      return inDate && matchesItem;
    }),
    [displayOrders, reportRange, reportItem],
  );

  const statsKpis = useMemo(() => {
    const totalRevenue = statsOrders.reduce((a, x) => a + x.quantity * (x.unit_price ?? 0), 0);
    const paidRevenue = statsOrders.filter((x) => x.payment_status === "paid").reduce((a, x) => a + x.quantity * (x.unit_price ?? 0), 0);
    const pendingRevenue = totalRevenue - paidRevenue;
    const totalUnits = statsOrders.reduce((a, x) => a + x.quantity, 0);
    const paidOrders = statsOrders.filter((x) => x.payment_status === "paid").length;
    return {
      totalRevenue,
      paidRevenue,
      pendingRevenue,
      totalUnits,
      paidOrders,
      totalOrders: statsOrders.length,
    };
  }, [statsOrders]);

  /* ── mutations ── */
  const createItemMut = useMutation({
    mutationFn: (i: UniformItemInput) => createUniformItem(i),
    onSuccess: () => { toast.success("Item added."); qc.invalidateQueries({ queryKey: ["uniform-items"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateItemMut = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UniformItemUpdateInput }) => updateUniformItem(id, input),
    onSuccess: () => { toast.success("Item updated."); qc.invalidateQueries({ queryKey: ["uniform-items"] }); setEditItem(null); },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteItemMut = useMutation({
    mutationFn: (id: string) => deleteUniformItem(id),
    onSuccess: () => { toast.success("Item deleted."); qc.invalidateQueries({ queryKey: ["uniform-items"] }); setDeleteItem(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const createEntryMut = useMutation({
    mutationFn: (i: StockEntryInput) => createStockEntry(i),
    onSuccess: () => {
      toast.success("Stock entry recorded.");
      qc.invalidateQueries({ queryKey: ["uniform-entries"] });
      qc.invalidateQueries({ queryKey: ["uniform-items"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteEntryMut = useMutation({
    mutationFn: (id: string) => deleteStockEntry(id),
    onSuccess: () => { toast.success("Entry deleted."); qc.invalidateQueries({ queryKey: ["uniform-entries"] }); setDeleteEntry(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const createOrderMut = useMutation({
    mutationFn: (i: UniformOrderInput) => createUniformOrder(i),
    onSuccess: () => { toast.success("Order recorded."); qc.invalidateQueries({ queryKey: ["uniform-orders"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const approveOrderMut = useMutation({
    mutationFn: (id: string) => approveOrder(id),
    onSuccess: () => { toast.success("Order approved."); qc.invalidateQueries({ queryKey: ["uniform-orders"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const confirmDispatchMut = useMutation({
    mutationFn: ({ id, ...input }: { id: string; contactName: string; contactPhone?: string | null; method: string; scheduledAt?: string | null; notes?: string | null }) =>
      confirmDispatch(id, input),
    onSuccess: () => { toast.success("Dispatch confirmed."); qc.invalidateQueries({ queryKey: ["uniform-orders"] }); setDispatchOrder(null); },
    onError: (e: Error) => toast.error(e.message),
  });
  const confirmDeliveryMut = useMutation({
    mutationFn: ({ id, deliveredBy, notes }: { id: string; deliveredBy?: string; notes?: string }) => confirmDelivery(id, deliveredBy, notes),
    onSuccess: () => { toast.success("Delivery confirmed."); qc.invalidateQueries({ queryKey: ["uniform-orders"] }); setDeliveryOrder(null); },
    onError: (e: Error) => toast.error(e.message),
  });
  const payMut = useMutation({
    mutationFn: ({ id, paymentMethod }: { id: string; paymentMethod?: string }) => recordPayment(id, paymentMethod),
    onSuccess: () => { toast.success("Payment recorded."); qc.invalidateQueries({ queryKey: ["uniform-orders"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const cancelOrderMut = useMutation({
    mutationFn: (id: string) => cancelOrder(id),
    onSuccess: () => { toast.success("Order cancelled."); qc.invalidateQueries({ queryKey: ["uniform-orders"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteOrderMut = useMutation({
    mutationFn: (id: string) => deleteUniformOrder(id),
    onSuccess: () => { toast.success("Order deleted."); qc.invalidateQueries({ queryKey: ["uniform-orders"] }); setDeleteOrder(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const changeOrdersFilter = (f: OrdersFilter) => { setOrdersFilter(f); setOrdersPage(1); };
  const changeOrdersRange  = (r: DateRange)   => { setStockOutRange(r);  setOrdersPage(1); };
  const changeOrdersQ      = (q: string)      => { setOrdersQ(q);      setOrdersPage(1); };

  /* ── topbar action ── */
  const actionBtn =
    tab === "status" ? (
      <button onClick={() => setAddItemOpen(true)} className="text-[11px] font-semibold text-text-2 hover:text-text-1 transition-colors">
        + New Item
      </button>
    ) : tab === "stock-in" ? (
      <TopbarButton onClick={() => setAddEntryOpen(true)}>+ Stock In</TopbarButton>
    ) : tab === "stock-out" ? (
      <TopbarButton onClick={() => setOrderOpen(true)}>+ New Order</TopbarButton>
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
            <TopbarTab active={tab === "status"}    onClick={() => setTab("status")}>Stock Status</TopbarTab>
            <TopbarTab active={tab === "stock-in"}  onClick={() => setTab("stock-in")}>Stock In</TopbarTab>
            <TopbarTab active={tab === "stock-out"} onClick={() => setTab("stock-out")}>Stock Out</TopbarTab>
            <TopbarTab active={tab === "reports"}   onClick={() => setTab("reports")}>Reports</TopbarTab>
          </>
        }
        action={actionBtn}
      />

      <div className="flex-1 overflow-y-auto px-5 py-4">

        {/* ══════════════════ STOCK STATUS TAB ══════════════════ */}
        {tab === "status" && (
          <>
            {/* KPIs */}
            <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <Kpi label="Available Stock"  value={statusKpis.totalStock.toLocaleString()} trend={`${displayItems.length} items`} tone="up" />
              <Kpi label="Total Stock In"    value={statusKpis.stockIn.toLocaleString()}    trend="all time"                  tone="info" />
              <Kpi label="Total Stock Out"   value={statusKpis.stockOut.toLocaleString()}   trend="delivered" tone="warn" />
              <Kpi label="Low Stock"         value={String(statusKpis.lowCount)}            trend={`items below ${uniformSettings.lowStockThreshold} units`}           tone={statusKpis.lowCount > 0 ? "warn" : "up"} />
            </div>

            {/* Filter bar */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <input
                value={statusQ}
                onChange={(e) => setStatusQ(e.target.value)}
                placeholder="Search item name…"
                className="min-w-[200px] rounded-md border border-black/20 bg-white px-3 py-1.5 text-[12px] text-black/70 placeholder:text-gray-400 outline-none hover:border-gold-3/50 focus:border-gold-3"
              />
              <DateRangeFilter value={statusRange} onChange={setStatusRange} />
            </div>

            {/* Current inventory table */}
            <div className="mb-4 overflow-hidden rounded-xl border border-border bg-card">
              <div className="border-b border-border px-3.5 py-2.5">
                <div className="text-[11px] font-bold text-gold">Current Stock Levels</div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border bg-bg-3 hover:bg-bg-3">
                    <TH>Item</TH>
                    <TH className="text-right">Stock In</TH>
                    <TH className="text-right">Stock Out</TH>
                    <TH className="text-right">Available</TH>
                    <TH className="text-right">Pending</TH>
                    <TH className="text-right">Unit Price</TH>
                    <TH>Status</TH>
                    {isLiveItems && <TH className="w-10" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itemPagination.pageRows.map((u) => (
                    <TableRow key={u.name} className="border-b border-border hover:bg-bg-2">
                      <TD>
                        <div className="flex items-center gap-2">
                          <div className="h-5 w-5 shrink-0 rounded border border-border" style={{ background: u.swatch ?? "var(--color-bg-4)" }} />
                          <span className="font-semibold text-foreground">{u.name}</span>
                        </div>
                      </TD>
                      <TD className="text-right text-text-2">{u.stock_in.toLocaleString()}</TD>
                      <TD className="text-right text-text-2">{u.stock_out_delivered.toLocaleString()}</TD>
                      <TD className="text-right font-bold text-foreground">{u.available_stock.toLocaleString()}</TD>
                      <TD className="text-right text-text-3">{u.pending_youth_orders.toLocaleString()}</TD>
                      <TD className="text-right text-text-2">{u.unit_price != null ? fmtKES(u.unit_price) : "—"}</TD>
                      <TD>
                        <Pill tone={u.available_stock < uniformSettings.lowStockThreshold ? "danger" : u.available_stock < uniformSettings.mediumStockThreshold ? "gold" : "success"}>
                          {u.available_stock < uniformSettings.lowStockThreshold ? "critical" : u.available_stock < uniformSettings.mediumStockThreshold ? "low" : "ok"}
                        </Pill>
                      </TD>
                      {isLiveItems && (
                        <TD>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="rounded p-1 hover:bg-bg-3">
                                <MoreVertical className="h-3.5 w-3.5 text-text-3" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-[140px]">
                              <DropdownMenuItem onClick={() => setViewItem(u)}>
                                <Eye className="mr-2 h-3.5 w-3.5" /> View
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setEditItem({ id: u.id, initial: itemToInitial(u) })}>
                                <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-danger focus:text-danger" onClick={() => setDeleteItem({ id: u.id, name: u.name })}>
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
              <TablePagination
                page={itemPagination.page}
                pageSize={itemPagination.pageSize}
                total={itemPagination.total}
                totalPages={itemPagination.totalPages}
                onPageChange={itemPagination.setPage}
                onPageSizeChange={itemPagination.setPageSize}
              />
            </div>
          </>
        )}

        {/* ══════════════════ STOCK IN TAB ══════════════════ */}
        {tab === "stock-in" && (
          <>
            {/* KPIs */}
            <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <Kpi label="Total Entries" value={String(stockInKpis.totalEntries)} trend="in period" tone="info" />
              <Kpi label="Total Quantity" value={stockInKpis.totalQty.toLocaleString()} trend="units added" tone="up" />
              <Kpi label="Unique Items" value={String(new Set(filteredEntries.map((e) => e.item_name)).size)} trend="items affected" tone="info" />
              <Kpi label="Activities" value={String(new Set(filteredEntries.map((e) => e.activity_name)).size)} trend="activity types" tone="info" />
            </div>

            {/* Filter bar */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <input
                value={stockInQ}
                onChange={(e) => setStockInQ(e.target.value)}
                placeholder="Search item, activity, notes…"
                className="min-w-[200px] rounded-md border border-black/20 bg-white px-3 py-1.5 text-[12px] text-black/70 placeholder:text-gray-400 outline-none hover:border-gold-3/50 focus:border-gold-3"
              />
              <DateRangeFilter value={stockInRange} onChange={setStockInRange} />
              <span className="ml-auto text-[9px] font-bold text-text-4">
                {filteredEntries.length} record{filteredEntries.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Stock entries table */}
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="border-b border-border px-3.5 py-2.5">
                <div className="text-[11px] font-bold text-gold">Stock In Log</div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border bg-bg-3 hover:bg-bg-3">
                    <TH>Date</TH>
                    <TH>Item</TH>
                    <TH>Activity</TH>
                    <TH className="text-right">Qty</TH>
                    <TH>Notes</TH>
                    {isLiveEntries && <TH className="w-10" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-6 text-center text-[11px] text-text-3">
                        No stock entries for this period.
                      </TableCell>
                    </TableRow>
                  ) : entryPagination.pageRows.map((e) => (
                    <TableRow key={e.id} className="border-b border-border hover:bg-bg-2">
                      <TD className="whitespace-nowrap text-text-2">{fmtDate(e.created_at)}</TD>
                      <TD className="font-semibold text-foreground">{e.item_name}</TD>
                      <TD className="text-text-2">{e.activity_name}</TD>
                      <TD className="text-right font-bold text-foreground">{e.quantity.toLocaleString()}</TD>
                      <TD className="max-w-[200px] truncate text-text-3">{e.description ?? "—"}</TD>
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
              {filteredEntries.length > 0 && (
                <TablePagination
                  page={entryPagination.page}
                  pageSize={entryPagination.pageSize}
                  total={entryPagination.total}
                  totalPages={entryPagination.totalPages}
                  onPageChange={entryPagination.setPage}
                  onPageSizeChange={entryPagination.setPageSize}
                />
              )}
            </div>
          </>
        )}

        {/* ══════════════════ STOCK OUT TAB ══════════════════ */}
        {tab === "stock-out" && (
          <>
            {/* KPIs */}
            <div className="mb-4 grid grid-cols-3 gap-2.5 sm:grid-cols-6">
              <Kpi label="Total Orders"      value={String(stockOutKpis.total)}      trend="all time" tone="info" />
              <Kpi label="Pending"          value={String(stockOutKpis.pending)}    trend="awaiting approval" tone="warn" />
              <Kpi label="Approved"         value={String(stockOutKpis.approved)}   trend="ready for payment" tone="info" />
              <Kpi label="Paid"             value={String(stockOutKpis.paid)}       trend="payment received" tone="up" />
              <Kpi label="Dispatched"       value={String(stockOutKpis.dispatched)} trend="in transit" tone="gold" />
              <Kpi label="Delivered"        value={String(stockOutKpis.delivered)}  trend="completed" tone="success" />
            </div>

            {/* Filter bar */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <input
                value={ordersQ}
                onChange={(e) => changeOrdersQ(e.target.value)}
                placeholder="Search CDM ID, youth, item, parish…"
                className="min-w-[200px] rounded-md border border-black/20 bg-white px-3 py-1.5 text-[12px] text-black/70 placeholder:text-gray-400 outline-none hover:border-gold-3/50 focus:border-gold-3"
              />
              <DateRangeFilter value={stockOutRange} onChange={changeOrdersRange} />
              <div className="mx-1 h-4 w-px bg-border" />
              {(["all", "pending", "approved", "paid", "dispatched", "delivered"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => changeOrdersFilter(f)}
                  className={`rounded-full px-3 py-1 text-[10px] font-bold transition-colors ${
                    ordersFilter === f ? "bg-danger text-white" : "bg-bg-3 text-text-2 hover:bg-bg-4"
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
              <span className="ml-auto text-[9px] font-bold text-text-4">
                {pagedOrdersTotal} record{pagedOrdersTotal !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Orders table */}
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border bg-bg-3 hover:bg-bg-3">
                    <TH>Order #</TH>
                    <TH>Date</TH>
                    <TH>Youth</TH>
                    <TH>Item</TH>
                    <TH className="text-right">Qty</TH>
                    <TH className="text-right">Total</TH>
                    <TH>Status</TH>
                    <TH>Payment</TH>
                    <TH className="w-14" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedOrderRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="py-6 text-center text-[11px] text-text-3">
                        No orders for this filter.
                      </TableCell>
                    </TableRow>
                  ) : pagedOrderRows.map((s) => {
                    const total = s.quantity * (s.unit_price ?? 0);
                    return (
                      <TableRow key={s.id} className="border-b border-border hover:bg-bg-2">
                        <TD className="whitespace-nowrap font-mono text-[10px] text-text-3">{s.order_number}</TD>
                        <TD className="whitespace-nowrap text-text-2">{fmtDate(s.ordered_at)}</TD>
                        <TD className="font-semibold text-foreground">
                          {s.youth_name ?? s.cdm_id ?? "—"}
                          <div className="font-normal text-text-3">{s.parish_name ?? "—"}</div>
                        </TD>
                        <TD className="text-text-2">{s.item_name}</TD>
                        <TD className="text-right text-foreground">{s.quantity}</TD>
                        <TD className="text-right font-semibold text-foreground">{fmtKES(total)}</TD>
                        <TD>
                          <Pill tone={STATUS_TONE[s.status]}>{STATUS_LABEL[s.status]}</Pill>
                        </TD>
                        <TD>
                          {s.payment_status === "paid" ? (
                            <span className="text-[10px] font-bold text-success">✓ Paid</span>
                          ) : (
                            <Pill tone="danger">{s.payment_status}</Pill>
                          )}
                        </TD>
                        <TD>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="rounded p-1 hover:bg-bg-3">
                                <MoreVertical className="h-3.5 w-3.5 text-text-3" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-[170px]">
                              <DropdownMenuItem onClick={() => setViewOrder(s)}>
                                <Eye className="mr-2 h-3.5 w-3.5" /> View
                              </DropdownMenuItem>
                              {isLiveOrders && s.status === "pending" && (
                                <DropdownMenuItem onClick={() => approveOrderMut.mutate(s.id)}>
                                  <BadgeCheck className="mr-2 h-3.5 w-3.5" /> Approve
                                </DropdownMenuItem>
                              )}
                              {isLiveOrders && s.status === "approved" && (
                                <DropdownMenuItem onClick={() => setPayOrder(s)}>
                                  <Banknote className="mr-2 h-3.5 w-3.5" /> Record Payment
                                </DropdownMenuItem>
                              )}
                              {isLiveOrders && s.payment_status === "paid" && s.status === "approved" && (
                                <DropdownMenuItem onClick={() => setDispatchOrder(s)}>
                                  <Truck className="mr-2 h-3.5 w-3.5" /> Dispatch
                                </DropdownMenuItem>
                              )}
                              {isLiveOrders && s.status === "dispatched" && (
                                <DropdownMenuItem onClick={() => setDeliveryOrder(s)}>
                                  <PackageCheck className="mr-2 h-3.5 w-3.5" /> Confirm Delivery
                                </DropdownMenuItem>
                              )}
                              {isLiveOrders && s.status !== "delivered" && s.status !== "cancelled" && (
                                <DropdownMenuSeparator />
                              )}
                              {isLiveOrders && s.status !== "delivered" && s.status !== "cancelled" && (
                                <DropdownMenuItem className="text-danger focus:text-danger" onClick={() => cancelOrderMut.mutate(s.id)}>
                                  <Trash2 className="mr-2 h-3.5 w-3.5" /> Cancel
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-danger focus:text-danger" onClick={() => setDeleteOrder({ id: s.id, name: s.order_number })}>
                                <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TD>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {pagedOrdersTotal > 0 && (
                <TablePagination
                  page={ordersPage}
                  pageSize={uniformSettings.ordersPageSize}
                  total={pagedOrdersTotal}
                  totalPages={pagedOrdersTotalPages}
                  onPageChange={setOrdersPage}
                  onPageSizeChange={() => {}}
                />
              )}
            </div>
          </>
        )}

        {/* ══════════════════ REPORTS TAB ══════════════════ */}
        {tab === "reports" && (
          <>
            {/* Filters */}
            <div className="mb-4 flex items-center gap-3">
              <DateRangeFilter value={reportRange} onChange={setReportRange} />
              <select
                value={reportItem}
                onChange={(e) => setReportItem(e.target.value)}
                className="rounded-md border border-border bg-bg-3 px-2 py-1.5 text-[11px] text-text-2 outline-none hover:border-gold-3/50 focus:border-gold-3"
              >
                <option value="all">All Items</option>
                {itemNames.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            {/* Charts Dashboard */}
            <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
              {/* Stock Levels by Item */}
              <Card>
                <div className="border-b border-border px-3.5 py-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-3.5 w-3.5 text-gold" />
                      <div className="text-[11px] font-bold text-gold">Stock Levels by Item</div>
                    </div>
                    <button className="rounded-md border border-border bg-bg-3 px-2 py-1 text-[9px] font-bold text-text-2 hover:bg-bg-4">
                      Export
                    </button>
                  </div>
                </div>
                <div className="p-3">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={displayItems.map((i) => ({ name: i.name, available: i.available_stock, stockIn: i.stock_in, stockOut: i.stock_out_delivered }))}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                      <XAxis dataKey="name" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid var(--color-border)' }} />
                      <Bar dataKey="available" fill="var(--color-success)" name="Available" />
                      <Bar dataKey="stockIn" fill="var(--color-info)" name="Stock In" />
                      <Bar dataKey="stockOut" fill="var(--color-warn)" name="Stock Out" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Revenue Trend */}
              <Card>
                <div className="border-b border-border px-3.5 py-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-3.5 w-3.5 text-gold" />
                      <div className="text-[11px] font-bold text-gold">Revenue Trend</div>
                    </div>
                    <button className="rounded-md border border-border bg-bg-3 px-2 py-1 text-[9px] font-bold text-text-2 hover:bg-bg-4">
                      Export
                    </button>
                  </div>
                </div>
                <div className="p-3">
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={groupByDay(displayOrders)}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={(v) => fmtKES(v)} />
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid var(--color-border)' }} formatter={(v: number) => fmtKES(v)} />
                      <Line type="monotone" dataKey="revenue" stroke="var(--color-gold)" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>

            <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
              {/* Order Status Distribution */}
              <Card>
                <div className="border-b border-border px-3.5 py-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <PieChart className="h-3.5 w-3.5 text-gold" />
                      <div className="text-[11px] font-bold text-gold">Order Status</div>
                    </div>
                    <button className="rounded-md border border-border bg-bg-3 px-2 py-1 text-[9px] font-bold text-text-2 hover:bg-bg-4">
                      Export
                    </button>
                  </div>
                </div>
                <div className="p-3">
                  <ResponsiveContainer width="100%" height={180}>
                    <RechartsPieChart>
                      <Pie
                        data={Object.entries(byStatus).map(([name, value]) => ({ name: STATUS_LABEL[name as OrderStatus], value }))}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={60}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        <Cell fill="var(--color-neutral)" key="pending" />
                        <Cell fill="var(--color-info)" key="approved" />
                        <Cell fill="var(--color-gold)" key="paid" />
                        <Cell fill="var(--color-warn)" key="dispatched" />
                        <Cell fill="var(--color-success)" key="delivered" />
                        <Cell fill="var(--color-danger)" key="cancelled" />
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid var(--color-border)' }} />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                  <div className="mt-2 grid grid-cols-3 gap-1 text-[9px]">
                    <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-neutral" /> Pending</div>
                    <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-info" /> Approved</div>
                    <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-gold" /> Paid</div>
                    <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-warn" /> Dispatched</div>
                    <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-success" /> Delivered</div>
                    <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-danger" /> Cancelled</div>
                  </div>
                </div>
              </Card>

              {/* Top Selling Items */}
              <Card>
                <div className="border-b border-border px-3.5 py-2.5">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-bold text-gold">Top Selling Items</div>
                    <button className="rounded-md border border-border bg-bg-3 px-2 py-1 text-[9px] font-bold text-text-2 hover:bg-bg-4">
                      Export
                    </button>
                  </div>
                </div>
                <div className="p-3">
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={groupByItem(displayOrders).slice(0, 5)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                      <XAxis type="number" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={(v) => fmtKES(v)} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} width={80} />
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid var(--color-border)' }} formatter={(v: number) => fmtKES(v)} />
                      <Bar dataKey="revenue" fill="var(--color-success)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Cashflow Summary */}
              <Card>
                <div className="border-b border-border px-3.5 py-2.5">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-bold text-gold">Cashflow Summary</div>
                    <button className="rounded-md border border-border bg-bg-3 px-2 py-1 text-[9px] font-bold text-text-2 hover:bg-bg-4">
                      Export
                    </button>
                  </div>
                </div>
                <div className="p-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-text-3">Total Revenue</span>
                    <span className="text-[11px] font-bold text-foreground">{fmtKES(statsKpis.totalRevenue)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-text-3">Paid Revenue</span>
                    <span className="text-[11px] font-bold text-success">{fmtKES(statsKpis.paidRevenue)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-text-3">Pending Revenue</span>
                    <span className="text-[11px] font-bold text-warn">{fmtKES(statsKpis.pendingRevenue)}</span>
                  </div>
                  <div className="h-px bg-border my-2" />
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-text-3">Total Orders</span>
                    <span className="text-[11px] font-semibold text-foreground">{statsKpis.totalOrders}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-text-3">Paid Orders</span>
                    <span className="text-[11px] font-semibold text-success">{statsKpis.paidOrders}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-text-3">Total Units</span>
                    <span className="text-[11px] font-semibold text-foreground">{statsKpis.totalUnits}</span>
                  </div>
                </div>
              </Card>
            </div>

            {/* Revenue by Item Table */}
            <Card>
              <div className="border-b border-border px-3.5 py-2.5">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-bold text-gold">Revenue by Item</div>
                  <button className="rounded-md border border-border bg-bg-3 px-2 py-1 text-[9px] font-bold text-text-2 hover:bg-bg-4">
                    Export CSV
                  </button>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border bg-bg-3 hover:bg-bg-3">
                    <TH>Item</TH>
                    <TH className="text-right">Units</TH>
                    <TH className="text-right">Revenue</TH>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupByItem(statsOrders).length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="py-4 text-center text-[11px] text-text-3">No data for this period.</TableCell></TableRow>
                  ) : groupByItem(statsOrders).map((row) => (
                    <TableRow key={row.name} className="border-b border-border hover:bg-bg-2">
                      <TD className="font-semibold text-foreground">{row.name}</TD>
                      <TD className="text-right text-text-2">{row.qty}</TD>
                      <TD className="text-right font-semibold text-foreground">{fmtKES(row.revenue)}</TD>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </>
        )}
      </div>

      {/* ══════════════════ DIALOGS ══════════════════ */}

      {/* Add Item */}
      <RecordFormDialog open={addItemOpen} onOpenChange={setAddItemOpen} title="Add Uniform Item"
        fields={itemAddFields} submitLabel="Add Item"
        onSubmit={(v) => createItemMut.mutate({ name: v.name, swatch: v.swatch || null, unitPrice: v.unitPrice ? parseFloat(v.unitPrice) : null })}
      />

      {/* Edit Item */}
      <RecordFormDialog open={!!editItem} onOpenChange={(o) => { if (!o) setEditItem(null); }} title="Edit Item"
        fields={itemEditFields} initial={editItem?.initial} submitLabel="Update"
        onSubmit={(v) => { if (!editItem) return; updateItemMut.mutate({ id: editItem.id, input: { name: v.name, swatch: v.swatch || null, unitPrice: v.unitPrice ? parseFloat(v.unitPrice) : null } }); }}
      />

      {/* View Item */}
      <ViewRecordDialog open={!!viewItem} onOpenChange={(o) => { if (!o) setViewItem(null); }} title={viewItem?.name ?? ""}
        fields={viewItem ? [
          { label: "Item Name",  value: viewItem.name },
          { label: "Stock In",   value: String(viewItem.stock_in) },
          { label: "Stock Out",  value: String(viewItem.stock_out_delivered) },
          { label: "Available", value: String(viewItem.available_stock) },
          { label: "Pending",    value: String(viewItem.pending_youth_orders) },
          { label: "Unit Price", value: viewItem.unit_price != null ? fmtKES(viewItem.unit_price) : "—" },
          { label: "Status",     value: <Pill tone={viewItem.available_stock < uniformSettings.lowStockThreshold ? "danger" : viewItem.available_stock < uniformSettings.mediumStockThreshold ? "gold" : "success"}>{viewItem.available_stock < uniformSettings.lowStockThreshold ? "Critical" : viewItem.available_stock < uniformSettings.mediumStockThreshold ? "Low" : "OK"}</Pill> },
        ] : []}
      />

      {/* Delete Item */}
      <AlertDialog open={!!deleteItem} onOpenChange={(o) => { if (!o) setDeleteItem(null); }}>
        <AlertDialogContent className="border-border bg-white">
          <AlertDialogHeader><AlertDialogTitle>Delete "{deleteItem?.name}"?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-danger text-white hover:bg-danger/90" onClick={() => deleteItem && deleteItemMut.mutate(deleteItem.id)}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Stock Entry */}
      <RecordFormDialog open={addEntryOpen} onOpenChange={setAddEntryOpen} title="Record Stock In"
        description="Log stock additions (sewing, supplier delivery, etc.)"
        fields={buildEntryFields(itemNames, activityNames)} submitLabel="Record"
        onSubmit={(v) => createEntryMut.mutate({
          itemName: v.item,
          activityName: v.activity,
          quantity: parseInt(v.quantity || "0", 10),
          description: v.notes || null,
        })}
      />

      {/* Delete Stock Entry */}
      <AlertDialog open={!!deleteEntry} onOpenChange={(o) => { if (!o) setDeleteEntry(null); }}>
        <AlertDialogContent className="border-border bg-white">
          <AlertDialogHeader><AlertDialogTitle>Delete entry "{deleteEntry?.name}"?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-danger text-white hover:bg-danger/90" onClick={() => deleteEntry && deleteEntryMut.mutate(deleteEntry.id)}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* New Order */}
      <RecordFormDialog open={orderOpen} onOpenChange={setOrderOpen} title="New Order"
        description="Create a new uniform order"
        fields={buildOrderFields(itemNames)} submitLabel="Create Order"
        onSubmit={(v) => createOrderMut.mutate({ itemName: v.item, youthId: null, cdmId: v.cdmId || null, quantity: parseInt(v.quantity || "1", 10), notes: v.notes || null })}
      />

      {/* View Order */}
      <ViewRecordDialog open={!!viewOrder} onOpenChange={(o) => { if (!o) setViewOrder(null); }}
        title={viewOrder ? `${viewOrder.order_number}` : ""}
        fields={viewOrder ? (() => {
          const total = viewOrder.quantity * (viewOrder.unit_price ?? 0);
          return [
            { label: "Order Number", value: viewOrder.order_number },
            { label: "Status", value: <Pill tone={STATUS_TONE[viewOrder.status]}>{STATUS_LABEL[viewOrder.status]}</Pill> },
            { label: "Youth", value: viewOrder.youth_name ?? viewOrder.cdm_id ?? "—" },
            { label: "Parish", value: viewOrder.parish_name ?? "—" },
            { label: "Item", value: viewOrder.item_name },
            { label: "Quantity", value: String(viewOrder.quantity) },
            { label: "Unit Price", value: fmtKES(viewOrder.unit_price ?? 0) },
            { label: "Total", value: fmtKES(total) },
            { label: "Payment Status", value: viewOrder.payment_status },
            { label: "Payment Method", value: viewOrder.payment_method ?? "—" },
            { label: "Ordered", value: fmtDate(viewOrder.ordered_at) },
            { label: "Reviewed", value: viewOrder.reviewed_at ? fmtDate(viewOrder.reviewed_at) : "—" },
            { label: "Dispatch Contact", value: viewOrder.dispatch_contact_name ?? "—" },
            { label: "Dispatch Method", value: viewOrder.dispatch_method ?? "—" },
            { label: "Dispatched", value: viewOrder.dispatched_at ? fmtDate(viewOrder.dispatched_at) : "—" },
            { label: "Delivered", value: viewOrder.delivered_at ? fmtDate(viewOrder.delivered_at) : "—" },
            { label: "Notes", value: viewOrder.review_notes ?? "—", full: true },
          ];
        })() : []}
      />

      {/* Delete Order */}
      <AlertDialog open={!!deleteOrder} onOpenChange={(o) => { if (!o) setDeleteOrder(null); }}>
        <AlertDialogContent className="border-border bg-white">
          <AlertDialogHeader><AlertDialogTitle>Delete order "{deleteOrder?.name}"?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-danger text-white hover:bg-danger/90" onClick={() => deleteOrder && deleteOrderMut.mutate(deleteOrder.id)}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Payment dialog */}
      <PaymentDialog order={payOrder} onClose={() => setPayOrder(null)}
        onConfirm={(id, method) => { payMut.mutate({ id, paymentMethod: method }); setPayOrder(null); }}
      />

      {/* Dispatch dialog */}
      <DispatchDialog order={dispatchOrder} onClose={() => setDispatchOrder(null)}
        onConfirm={(id, input) => confirmDispatchMut.mutate({ id, ...input })}
      />

      {/* Delivery dialog */}
      <DeliveryDialog order={deliveryOrder} onClose={() => setDeliveryOrder(null)}
        onConfirm={(id, deliveredBy, notes) => confirmDeliveryMut.mutate({ id, deliveredBy, notes })}
      />
    </>
  );
}

/* ── payment dialog ── */

function PaymentDialog({
  order, onClose, onConfirm,
}: { order: UniformOrder | null; onClose: () => void; onConfirm: (id: string, paymentMethod?: string) => void }) {
  const [paymentMethod, setPaymentMethod] = useState("");
  useEffect(() => { if (order) setPaymentMethod(""); }, [order]);
  if (!order) return null;

  const total = order.quantity * (order.unit_price ?? 0);

  return (
    <Dialog open={!!order} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm border-border bg-white text-foreground">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-gold">Record Payment</DialogTitle>
          <DialogDescription>{order.order_number} — {order.item_name} × {order.quantity}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-bg-2 p-3 text-[11px] space-y-1.5">
            <div className="flex justify-between"><span className="text-text-3">Total Due</span><span className="font-bold">{fmtKES(total)}</span></div>
          </div>
          <label className="block space-y-1 text-[10px] font-bold uppercase tracking-wide text-text-3">
            <span>Payment Method</span>
            <Input value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} placeholder="e.g. Cash, M-Pesa, Bank Transfer" className="mt-1" />
          </label>
        </div>
        <DialogFooter>
          <button onClick={onClose} className="rounded-lg border border-border bg-bg-3 px-3 py-2 text-[11px] font-bold text-text-2">Cancel</button>
          <button onClick={() => { onConfirm(order.id, paymentMethod || null); }} className="rounded-lg bg-primary px-4 py-2 text-[11px] font-bold text-primary-foreground hover:opacity-90">Record Payment</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── dispatch dialog ── */

function DispatchDialog({
  order, onClose, onConfirm,
}: {
  order: UniformOrder | null;
  onClose: () => void;
  onConfirm: (id: string, input: { contactName: string; contactPhone?: string | null; method: string; scheduledAt?: string | null; notes?: string | null }) => void;
}) {
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [method, setMethod] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (order) { setContactName(""); setContactPhone(""); setMethod(""); setScheduledAt(""); setNotes(""); }
  }, [order]);

  if (!order) return null;

  return (
    <Dialog open={!!order} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm border-border bg-white text-foreground">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-gold">Confirm Dispatch</DialogTitle>
          <DialogDescription>{order.order_number} — {order.item_name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block space-y-1 text-[10px] font-bold uppercase tracking-wide text-text-3">
            <span>Delivering person / rider *</span>
            <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="e.g. Brother Kevin" />
          </label>
          <label className="block space-y-1 text-[10px] font-bold uppercase tracking-wide text-text-3">
            <span>Contact phone</span>
            <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+254700000000" />
          </label>
          <label className="block space-y-1 text-[10px] font-bold uppercase tracking-wide text-text-3">
            <span>Dispatch method *</span>
            <Input value={method} onChange={(e) => setMethod(e.target.value)} placeholder="e.g. Boda rider, Parish pickup, Courier" />
          </label>
          <label className="block space-y-1 text-[10px] font-bold uppercase tracking-wide text-text-3">
            <span>Expected delivery date</span>
            <Input type="date" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          </label>
          <label className="block space-y-1 text-[10px] font-bold uppercase tracking-wide text-text-3">
            <span>Notes</span>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes..." />
          </label>
        </div>
        <DialogFooter>
          <button onClick={onClose} className="rounded-lg border border-border bg-bg-3 px-3 py-2 text-[11px] font-bold text-text-2">Cancel</button>
          <button
            onClick={() => {
              if (!contactName.trim() || !method.trim()) { toast.error("Contact person and method are required"); return; }
              onConfirm(order.id, { contactName: contactName.trim(), contactPhone: contactPhone.trim() || null, method: method.trim(), scheduledAt: scheduledAt || null, notes: notes.trim() || null });
            }}
            className="rounded-lg bg-primary px-4 py-2 text-[11px] font-bold text-primary-foreground hover:opacity-90"
          >
            Confirm Dispatch
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── delivery dialog ── */

function DeliveryDialog({
  order, onClose, onConfirm,
}: {
  order: UniformOrder | null;
  onClose: () => void;
  onConfirm: (id: string, deliveredBy?: string, notes?: string) => void;
}) {
  const [deliveredBy, setDeliveredBy] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (order) { setDeliveredBy(""); setNotes(""); }
  }, [order]);

  if (!order) return null;

  return (
    <Dialog open={!!order} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm border-border bg-white text-foreground">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-gold">Confirm Delivery</DialogTitle>
          <DialogDescription>{order.order_number} — {order.item_name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block space-y-1 text-[10px] font-bold uppercase tracking-wide text-text-3">
            <span>Delivered by (recipient name)</span>
            <Input value={deliveredBy} onChange={(e) => setDeliveredBy(e.target.value)} placeholder="Youth name or recipient" />
          </label>
          <label className="block space-y-1 text-[10px] font-bold uppercase tracking-wide text-text-3">
            <span>Notes</span>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Delivery notes..." />
          </label>
        </div>
        <DialogFooter>
          <button onClick={onClose} className="rounded-lg border border-border bg-bg-3 px-3 py-2 text-[11px] font-bold text-text-2">Cancel</button>
          <button onClick={() => { onConfirm(order.id, deliveredBy || null, notes || null); }} className="rounded-lg bg-primary px-4 py-2 text-[11px] font-bold text-primary-foreground hover:opacity-90">Confirm Delivery</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── script — types, constants & helpers ── */

type TabId = "status" | "stock-in" | "stock-out" | "reports";
type OrdersFilter = "all" | "pending" | "approved" | "paid" | "dispatched" | "delivered";

const EMPTY_RANGE: DateRange = { from: undefined, to: undefined };

const isLiveItems   = true;
const isLiveEntries = true;
const isLiveOrders  = true;

const itemAddFields: FieldDef[] = [
  { key: "name",      label: "Item Name",                required: true, placeholder: "e.g. T-Shirt — Green" },
  { key: "swatch",    label: "Color Swatch (CSS)",       placeholder: "e.g. #00ff00 or var(--color-success)" },
  { key: "unitPrice", label: "Unit Price (KES)",         type: "number", placeholder: "e.g. 450" },
];

const itemEditFields: FieldDef[] = [
  { key: "name",      label: "Item Name",                required: true },
  { key: "swatch",    label: "Color Swatch (CSS)" },
  { key: "unitPrice", label: "Unit Price (KES)",         type: "number" },
];

function buildEntryFields(itemNames: string[], activityNames: string[]): FieldDef[] {
  const items = itemNames.length > 0 ? itemNames : MOCK_ITEMS.map((s) => s.name);
  const activities = activityNames.length > 0 ? activityNames : ["Sewn", "Received from Supplier", "Damaged Return", "Audit Adjustment"];
  return [
    { key: "item",      label: "Item",           type: "select", required: true, options: items },
    { key: "activity",  label: "Activity",       type: "select", required: true, options: activities },
    { key: "quantity",  label: "Quantity",       type: "number", required: true, placeholder: "e.g. 50" },
    { key: "notes",     label: "Notes",          type: "textarea", full: true, placeholder: "Batch #, sizes breakdown…" },
  ];
}

function buildOrderFields(itemNames: string[]): FieldDef[] {
  const items = itemNames.length > 0 ? itemNames : MOCK_ITEMS.map((s) => s.name);
  return [
    { key: "item",      label: "Item",           type: "select", required: true, options: items },
    { key: "cdmId",     label: "CDM ID",         placeholder: "CDM-XXXX" },
    { key: "quantity",  label: "Quantity",       type: "number", required: true, placeholder: "1" },
    { key: "notes",     label: "Notes",          type: "textarea", full: true },
  ];
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });

const fmtKES = (n: number) => `KES ${Math.round(n).toLocaleString()}`;

function groupByItem(orders: UniformOrder[]) {
  const m = new Map<string, { qty: number; revenue: number }>();
  for (const s of orders) {
    const e = m.get(s.item_name) ?? { qty: 0, revenue: 0 };
    m.set(s.item_name, { qty: e.qty + s.quantity, revenue: e.revenue + s.quantity * (s.unit_price ?? 0) });
  }
  return Array.from(m.entries()).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue);
}

function groupByDay(orders: UniformOrder[]) {
  const m = new Map<string, { qty: number; revenue: number }>();
  for (const s of orders) {
    const key = fmtDate(s.ordered_at);
    const e   = m.get(key) ?? { qty: 0, revenue: 0 };
    m.set(key, { qty: e.qty + s.quantity, revenue: e.revenue + s.quantity * (s.unit_price ?? 0) });
  }
  return Array.from(m.entries()).map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 30);
}

const itemToInitial = (s: UniformItemWithStock): Record<string, string> => ({
  name: s.name, swatch: s.swatch ?? "", unitPrice: s.unit_price != null ? String(s.unit_price) : "",
});

const STATUS_TONE: Record<OrderStatus, "neutral" | "info" | "gold" | "success" | "danger"> = {
  pending: "neutral",
  approved: "info",
  paid: "gold",
  dispatched: "gold",
  delivered: "success",
  cancelled: "danger",
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  paid: "Paid",
  dispatched: "Dispatched",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/* ── mock data ── */

const MOCK_ITEMS: UniformItemWithStock[] = [
  { id: "", name: "T-Shirt — Green",     swatch: "var(--color-success)", unit_price: 450, created_at: "", updated_at: "", stock_in: 480, stock_out_delivered: 120, pending_youth_orders: 30, available_stock: 360 },
  { id: "", name: "T-Shirt — Gold",      swatch: "var(--color-gold)",    unit_price: 450, created_at: "", updated_at: "", stock_in: 120, stock_out_delivered: 50,  pending_youth_orders: 20, available_stock: 70 },
  { id: "", name: "Cap — Embroidered",   swatch: "var(--color-bg-4)",    unit_price: 350, created_at: "", updated_at: "", stock_in: 240, stock_out_delivered: 80, pending_youth_orders: 10, available_stock: 160 },
  { id: "", name: "Sash — Mission Week", swatch: "var(--color-danger)",  unit_price: 250, created_at: "", updated_at: "", stock_in: 60,  stock_out_delivered: 20, pending_youth_orders: 5,  available_stock: 40 },
];

const MOCK_ENTRIES: StockEntry[] = [
  { id: "e1", item_id: null, item_name: "T-Shirt — Green",     activity_id: null, activity_name: "Sewn", quantity: 50, description: "Batch #3", created_at: "2026-06-19T09:00:00Z" },
  { id: "e2", item_id: null, item_name: "T-Shirt — Gold",      activity_id: null, activity_name: "Sewn", quantity: 30, description: "Batch #2", created_at: "2026-06-18T10:00:00Z" },
  { id: "e3", item_id: null, item_name: "Cap — Embroidered",   activity_id: null, activity_name: "Sewn", quantity: 20, description: null, created_at: "2026-06-17T11:00:00Z" },
  { id: "e4", item_id: null, item_name: "T-Shirt — Green",     activity_id: null, activity_name: "Received from Supplier", quantity: 100, description: "Initial batch", created_at: "2026-06-01T08:00:00Z" },
  { id: "e5", item_id: null, item_name: "Sash — Mission Week", activity_id: null, activity_name: "Sewn", quantity: 60, description: "Mission week batch", created_at: "2026-06-05T08:00:00Z" },
];

const ORDER_DEFAULTS = {
  order_number: "ORD-2026-00000", ordered_by: null, youth_id: null, cdm_id: null,
  reviewed_at: null, reviewed_by: null, review_notes: null,
  payment_status: "pending" as const, paid_at: null, paid_by: null, payment_method: null,
  dispatch_contact_name: null, dispatch_contact_phone: null, dispatch_method: null,
  dispatch_scheduled_at: null, dispatched_at: null, dispatch_by: null, dispatch_notes: null,
  delivered_at: null, delivered_by: null, delivery_notes: null,
  created_by: null, updated_by: null, deleted_at: null, deleted_by: null,
  status: "pending" as const,
};

const MOCK_ORDERS: UniformOrder[] = [
  { id: "m1", ...ORDER_DEFAULTS, order_number: "ORD-2026-00001", item_id: null, item_name: "T-Shirt — Green", youth_name: "John Kamau", parish_name: "Kagio", quantity: 1, unit_price: 450, ordered_at: "2026-06-15T09:00:00Z", status: "delivered", payment_status: "paid" },
  { id: "m2", ...ORDER_DEFAULTS, order_number: "ORD-2026-00002", item_id: null, item_name: "T-Shirt — Gold", youth_name: "Mary Wanjiku", parish_name: "Maragwā", quantity: 1, unit_price: 450, ordered_at: "2026-06-16T10:00:00Z", status: "pending", payment_status: "pending" },
  { id: "m3", ...ORDER_DEFAULTS, order_number: "ORD-2026-00003", item_id: null, item_name: "Cap — Embroidered", youth_name: "Peter Otieno", parish_name: "Kangari", quantity: 2, unit_price: 350, ordered_at: "2026-06-17T11:00:00Z", status: "approved", payment_status: "paid" },
  { id: "m4", ...ORDER_DEFAULTS, order_number: "ORD-2026-00004", item_id: null, item_name: "T-Shirt — Green", youth_name: "Grace Njoki", parish_name: "Kiria-Ini", quantity: 1, unit_price: 450, ordered_at: "2026-06-18T08:00:00Z", status: "dispatched", payment_status: "paid" },
  { id: "m5", ...ORDER_DEFAULTS, order_number: "ORD-2026-00005", item_id: null, item_name: "Sash — Mission Week", youth_name: "James Mutua", parish_name: "Kagio", quantity: 1, unit_price: 250, ordered_at: "2026-06-19T07:00:00Z", status: "delivered", payment_status: "paid" },
];
