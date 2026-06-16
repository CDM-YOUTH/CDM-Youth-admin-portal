import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MoreVertical, Eye, Pencil, Trash2 } from "lucide-react";
import { Topbar, TopbarButton } from "@/components/admin/topbar";
import { Card, CardBody, CardHead, Kpi, Pill } from "@/components/admin/ui-bits";
import { RecordFormDialog, type FieldDef } from "@/components/admin/record-form-dialog";
import { ViewRecordDialog } from "@/components/admin/view-record-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ORGANIZATION } from "@/lib/mock-data";
import {
  createUniformOrder,
  deleteUniformOrder,
  deleteUniformSku,
  listUniformOrders,
  listUniformSkus,
  updateUniformOrder,
  updateUniformSku,
  type OrderStatus,
  type UniformOrder,
  type UniformOrderInput,
  type UniformOrderUpdateInput,
  type UniformSku,
  type UniformSkuUpdateInput,
} from "@/lib/db/uniforms";

export const Route = createFileRoute("/admin/uniforms")({
  head: () => ({
    meta: [
      { title: "Uniforms — CDM Youth Office" },
      { name: "description", content: "Diocese-wide uniform procurement, stock, and distribution tracking." },
    ],
  }),
  component: UniformsPage,
});

const deaneryOptions = ORGANIZATION.map((d) => d.name);
const ORDER_STATUS_OPTIONS: OrderStatus[] = ["pending", "ordered", "received", "cancelled"];

function buildOrderAddFields(skuNames: string[]): FieldDef[] {
  return [
    {
      key: "item", label: "Item / SKU", type: "select", required: true,
      options: skuNames.length > 0 ? skuNames : ["T-Shirt — Green", "T-Shirt — Gold", "Cap — Embroidered", "Sash — Mission Week"],
    },
    { key: "quantity",          label: "Quantity",              type: "number",  required: true, placeholder: "e.g. 200" },
    { key: "supplier",          label: "Supplier",              placeholder: "e.g. Diocese Uniform Supplies Ltd" },
    { key: "estimatedDelivery", label: "Estimated Delivery Date", type: "date" },
    { key: "deanery",           label: "Destination Deanery",   type: "select",  options: deaneryOptions },
    { key: "notes",             label: "Order Notes",           type: "textarea", full: true, placeholder: "Special instructions, sizes breakdown…" },
  ];
}

function buildOrderEditFields(skuNames: string[]): FieldDef[] {
  return [
    ...buildOrderAddFields(skuNames),
    { key: "status", label: "Order Status", type: "select", required: true, options: ORDER_STATUS_OPTIONS },
  ];
}

const skuEditFields: FieldDef[] = [
  { key: "name",      label: "Item Name",        required: true },
  { key: "inStock",   label: "In Stock",          type: "number", required: true },
  { key: "onOrder",   label: "On Order",          type: "number", required: true },
  { key: "unitPrice", label: "Unit Price (KES)",  type: "number", placeholder: "e.g. 450" },
];

function orderToInitial(o: UniformOrder): Record<string, string> {
  return {
    item:              o.item_name,
    quantity:          String(o.quantity),
    supplier:          o.supplier            ?? "",
    estimatedDelivery: o.estimated_delivery  ?? "",
    deanery:           o.deanery_name        ?? "",
    status:            o.status,
    notes:             o.notes               ?? "",
  };
}

function skuToInitial(s: UniformSku): Record<string, string> {
  return {
    name:      s.name,
    inStock:   String(s.in_stock),
    onOrder:   String(s.on_order),
    unitPrice: s.unit_price != null ? String(s.unit_price) : "",
  };
}

function orderStatusTone(s: OrderStatus): "success" | "danger" | "gold" | "info" {
  if (s === "received")  return "success";
  if (s === "cancelled") return "danger";
  if (s === "ordered")   return "info";
  return "gold";
}

function UniformsPage() {
  const [orderOpen,       setOrderOpen]       = useState(false);
  const [viewingOrder,    setViewingOrder]    = useState<UniformOrder | null>(null);
  const [editingOrder,    setEditingOrder]    = useState<{ id: string; initial: Record<string, string> } | null>(null);
  const [deleteOrder,     setDeleteOrder]     = useState<{ id: string; name: string } | null>(null);
  const [viewingSku,      setViewingSku]      = useState<UniformSku | null>(null);
  const [editingSku,      setEditingSku]      = useState<{ id: string; initial: Record<string, string> } | null>(null);
  const [deleteSku,       setDeleteSku]       = useState<{ id: string; name: string } | null>(null);
  const qc = useQueryClient();

  const { data: skusRaw } = useQuery({ queryKey: ["uniform-skus"], queryFn: listUniformSkus });
  const skus = (skusRaw ?? []) as UniformSku[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: ordersRaw, isLoading: ordersLoading } = useQuery({ queryKey: ["uniform-orders"], queryFn: listUniformOrders as any });
  const orders = (ordersRaw ?? []) as UniformOrder[];

  const createMut = useMutation({
    mutationFn: (input: UniformOrderInput) => createUniformOrder(input),
    onSuccess: () => {
      toast.success("Order placed — procurement team notified.");
      qc.invalidateQueries({ queryKey: ["uniform-orders"] });
      qc.invalidateQueries({ queryKey: ["uniform-skus"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateOrderMut = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UniformOrderUpdateInput }) =>
      updateUniformOrder(id, input),
    onSuccess: () => {
      toast.success("Order updated.");
      qc.invalidateQueries({ queryKey: ["uniform-orders"] });
      setEditingOrder(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteOrderMut = useMutation({
    mutationFn: (id: string) => deleteUniformOrder(id),
    onSuccess: () => {
      toast.success("Order deleted.");
      qc.invalidateQueries({ queryKey: ["uniform-orders"] });
      setDeleteOrder(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateSkuMut = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UniformSkuUpdateInput }) =>
      updateUniformSku(id, input),
    onSuccess: () => {
      toast.success("Stock updated.");
      qc.invalidateQueries({ queryKey: ["uniform-skus"] });
      setEditingSku(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteSkuMut = useMutation({
    mutationFn: (id: string) => deleteUniformSku(id),
    onSuccess: () => {
      toast.success("SKU deleted.");
      qc.invalidateQueries({ queryKey: ["uniform-skus"] });
      setDeleteSku(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const displaySkus  = skus.length > 0 ? skus : MOCK_STOCK;
  const isLiveSkus   = skus.length > 0;
  const isLiveOrders = orders.length > 0;
  const totalStock   = displaySkus.reduce((s, u) => s + u.in_stock, 0);
  const totalOrder   = displaySkus.reduce((s, u) => s + u.on_order, 0);
  const orderFields  = buildOrderAddFields(skus.map((s) => s.name));
  const orderEditFs  = buildOrderEditFields(skus.map((s) => s.name));

  return (
    <>
      <Topbar
        title="Uniforms & Procurement"
        description="Track stock levels, deanery distributions, and youth payments."
        action={<TopbarButton onClick={() => setOrderOpen(true)}>+ New Order</TopbarButton>}
      />
      <div className="flex-1 overflow-y-auto px-5 py-4">

        <div className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-4">
          <Kpi label="In Stock"             value={totalStock.toLocaleString()} trend={`across ${displaySkus.length} SKUs`} tone="up" />
          <Kpi label="On Order"             value={totalOrder.toLocaleString()} trend={ordersLoading ? "…" : `${orders.filter((o) => o.status === "pending" || o.status === "ordered").length} active`} tone="info" />
          <Kpi label="Distributed (YTD)"    value="2,440"                       trend="+12%"           tone="up" />
          <Kpi label="Outstanding Payments" value="KES 84k"                     trend="142 youths"     tone="warn" />
        </div>

        {/* SKU stock card */}
        <Card>
          <CardHead title="Stock by SKU" action="Manage SKUs →" />
          <CardBody className="space-y-2">
            {displaySkus.map((u) => (
              <div key={u.name} className="flex items-center gap-3 rounded-lg border border-border bg-bg-2 p-3">
                <div className="h-10 w-10 shrink-0 rounded-md" style={{ background: u.swatch ?? "var(--color-bg-4)" }} />
                <div className="flex-1 leading-tight">
                  <div className="text-[12px] font-semibold text-text-1">{u.name}</div>
                  <div className="text-[10px] text-text-3">In stock: {u.in_stock} · On order: {u.on_order}</div>
                </div>
                <Pill tone={u.in_stock < 200 ? "gold" : "success"}>{u.in_stock < 200 ? "low stock" : "ok"}</Pill>
                {isLiveSkus && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="rounded p-1 hover:bg-bg-3">
                        <MoreVertical className="h-3.5 w-3.5 text-text-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[140px]">
                      <DropdownMenuItem onClick={() => setViewingSku(u as UniformSku)}>
                        <Eye className="mr-2 h-3.5 w-3.5" /> View
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setEditingSku({ id: (u as UniformSku).id, initial: skuToInitial(u as UniformSku) })}>
                        <Pencil className="mr-2 h-3.5 w-3.5" /> Adjust Stock
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-danger focus:text-danger"
                        onClick={() => setDeleteSku({ id: (u as UniformSku).id, name: u.name })}
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ))}
          </CardBody>
        </Card>

        {/* Orders card */}
        {(isLiveOrders || orders.length > 0) && (
          <Card className="mt-3">
            <CardHead title="Recent Orders" subtitle="Latest 10" />
            <CardBody className="space-y-1.5">
              {orders.slice(0, 10).map((o) => (
                <div key={o.id} className="flex items-center gap-3 rounded-lg border border-border bg-bg-2 px-3 py-2 text-[11px]">
                  <span className="flex-1 font-semibold text-foreground">{o.item_name}</span>
                  <span className="text-text-2">×{o.quantity}</span>
                  {o.deanery_name && <span className="text-text-3">{o.deanery_name}</span>}
                  <Pill tone={orderStatusTone(o.status)}>{o.status}</Pill>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="rounded p-1 hover:bg-bg-3">
                        <MoreVertical className="h-3.5 w-3.5 text-text-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[140px]">
                      <DropdownMenuItem onClick={() => setViewingOrder(o)}>
                        <Eye className="mr-2 h-3.5 w-3.5" /> View
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setEditingOrder({ id: o.id, initial: orderToInitial(o) })}>
                        <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-danger focus:text-danger"
                        onClick={() => setDeleteOrder({ id: o.id, name: o.item_name })}
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </CardBody>
          </Card>
        )}
      </div>

      {/* New Order */}
      <RecordFormDialog
        open={orderOpen}
        onOpenChange={setOrderOpen}
        title="New Uniform Order"
        description="Place a procurement order. Stock levels update once the order is received and confirmed."
        fields={orderFields}
        submitLabel="Place Order"
        onSubmit={(values) => {
          createMut.mutate({
            itemName:          values.item,
            quantity:          parseInt(values.quantity || "0", 10),
            supplier:          values.supplier          || null,
            deaneryName:       values.deanery           || null,
            estimatedDelivery: values.estimatedDelivery || null,
            notes:             values.notes             || null,
          });
        }}
      />

      {/* Edit Order */}
      <RecordFormDialog
        open={!!editingOrder}
        onOpenChange={(o) => { if (!o) setEditingOrder(null); }}
        title="Edit Uniform Order"
        description="Update order details and status."
        fields={orderEditFs}
        initial={editingOrder?.initial}
        submitLabel="Save Changes"
        onSubmit={(values) => {
          if (!editingOrder) return;
          updateOrderMut.mutate({
            id: editingOrder.id,
            input: {
              itemName:          values.item,
              quantity:          parseInt(values.quantity || "0", 10),
              supplier:          values.supplier          || null,
              deaneryName:       values.deanery           || null,
              estimatedDelivery: values.estimatedDelivery || null,
              status:            (values.status || "pending") as OrderStatus,
              notes:             values.notes             || null,
            },
          });
        }}
      />

      {/* View Order */}
      <ViewRecordDialog
        open={!!viewingOrder}
        onOpenChange={(o) => { if (!o) setViewingOrder(null); }}
        title={viewingOrder ? `Order — ${viewingOrder.item_name}` : ""}
        fields={viewingOrder ? [
          { label: "Item / SKU",          value: viewingOrder.item_name },
          { label: "Quantity",            value: String(viewingOrder.quantity) },
          { label: "Status",              value: <Pill tone={orderStatusTone(viewingOrder.status)}>{viewingOrder.status}</Pill> },
          { label: "Supplier",            value: viewingOrder.supplier ?? "—" },
          { label: "Destination Deanery", value: viewingOrder.deanery_name ?? "—" },
          { label: "Est. Delivery",       value: viewingOrder.estimated_delivery ?? "—" },
          { label: "Placed",              value: new Date(viewingOrder.created_at).toLocaleString() },
          { label: "Notes",               value: viewingOrder.notes ?? "—", full: true },
        ] : []}
      />

      {/* Edit SKU (Adjust Stock) */}
      <RecordFormDialog
        open={!!editingSku}
        onOpenChange={(o) => { if (!o) setEditingSku(null); }}
        title="Adjust Stock"
        description="Update stock levels and pricing for this SKU."
        fields={skuEditFields}
        initial={editingSku?.initial}
        submitLabel="Update Stock"
        onSubmit={(values) => {
          if (!editingSku) return;
          updateSkuMut.mutate({
            id: editingSku.id,
            input: {
              name:      values.name,
              inStock:   parseInt(values.inStock   || "0", 10),
              onOrder:   parseInt(values.onOrder   || "0", 10),
              unitPrice: values.unitPrice ? parseFloat(values.unitPrice) : null,
            },
          });
        }}
      />

      {/* View SKU */}
      <ViewRecordDialog
        open={!!viewingSku}
        onOpenChange={(o) => { if (!o) setViewingSku(null); }}
        title={viewingSku?.name ?? ""}
        fields={viewingSku ? [
          { label: "Item Name",   value: viewingSku.name },
          { label: "In Stock",    value: String(viewingSku.in_stock) },
          { label: "On Order",    value: String(viewingSku.on_order) },
          { label: "Unit Price",  value: viewingSku.unit_price != null ? `KES ${viewingSku.unit_price}` : "—" },
          { label: "Stock Status", value: <Pill tone={viewingSku.in_stock < 200 ? "gold" : "success"}>{viewingSku.in_stock < 200 ? "Low Stock" : "OK"}</Pill> },
        ] : []}
      />

      {/* Delete Order */}
      <AlertDialog open={!!deleteOrder} onOpenChange={(o) => { if (!o) setDeleteOrder(null); }}>
        <AlertDialogContent className="border-border bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete order for "{deleteOrder?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove the order record. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger text-white hover:bg-danger/90"
              onClick={() => deleteOrder && deleteOrderMut.mutate(deleteOrder.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete SKU */}
      <AlertDialog open={!!deleteSku} onOpenChange={(o) => { if (!o) setDeleteSku(null); }}>
        <AlertDialogContent className="border-border bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete SKU "{deleteSku?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this SKU and any associated order records. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger text-white hover:bg-danger/90"
              onClick={() => deleteSku && deleteSkuMut.mutate(deleteSku.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

const MOCK_STOCK = [
  { id: "", name: "T-Shirt — Green",     swatch: "var(--color-success)", in_stock: 480, on_order: 200, unit_price: null, created_at: "" },
  { id: "", name: "T-Shirt — Gold",      swatch: "var(--color-gold)",    in_stock: 120, on_order: 350, unit_price: null, created_at: "" },
  { id: "", name: "Cap — Embroidered",   swatch: "var(--color-bg-4)",    in_stock: 240, on_order: 100, unit_price: null, created_at: "" },
  { id: "", name: "Sash — Mission Week", swatch: "var(--color-danger)",  in_stock:  60, on_order: 180, unit_price: null, created_at: "" },
];
