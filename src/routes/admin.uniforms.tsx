import { createFileRoute } from "@tanstack/react-router";
import { Topbar, TopbarButton } from "@/components/admin/topbar";
import { Card, CardBody, CardHead, Kpi, PageHeader, Pill } from "@/components/admin/ui-bits";
import { UNIFORM_STOCK } from "@/lib/mock-data";

export const Route = createFileRoute("/admin/uniforms")({
  head: () => ({
    meta: [
      { title: "Uniforms — CDM Youth Office" },
      { name: "description", content: "Diocese-wide uniform procurement, stock, and distribution tracking." },
    ],
  }),
  component: UniformsPage,
});

function UniformsPage() {
  return (
    <>
      <Topbar title="Uniforms" action={<TopbarButton>+ New Order</TopbarButton>} />
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <PageHeader title="Uniforms & Procurement" description="Track stock levels, deanery distributions, and youth payments." />

        <div className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-4">
          <Kpi label="In Stock" value="900" trend="across 4 SKUs" tone="up" />
          <Kpi label="On Order" value="830" trend="ETA 10 Mar" tone="info" />
          <Kpi label="Distributed (YTD)" value="2,440" trend="+12%" tone="up" />
          <Kpi label="Outstanding Payments" value="KES 84k" trend="142 youths" tone="warn" />
        </div>

        <Card>
          <CardHead title="Stock by SKU" action="Manage SKUs →" />
          <CardBody className="space-y-2">
            {UNIFORM_STOCK.map((u) => (
              <div key={u.item} className="flex items-center gap-3 rounded-lg border border-border bg-bg-2 p-3">
                <div
                  className="h-10 w-10 shrink-0 rounded-md"
                  style={{ background: u.swatch }}
                />
                <div className="flex-1 leading-tight">
                  <div className="text-[12px] font-semibold text-text-1">{u.item}</div>
                  <div className="text-[10px] text-text-3">In stock: {u.inStock} · On order: {u.ordered}</div>
                </div>
                <Pill tone={u.inStock < 200 ? "gold" : "success"}>
                  {u.inStock < 200 ? "low stock" : "ok"}
                </Pill>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
