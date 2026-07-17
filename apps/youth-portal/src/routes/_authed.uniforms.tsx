import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShoppingBag, Check } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n/context";
import { supabase } from "@/integrations/supabase/client";
import { initiateStkPush } from "@/rpc/mpesa";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authed/uniforms")({
  head: () => ({ meta: [{ title: "Uniforms & Merch — CDM Youth Portal" }] }),
  component: UniformsPage,
});

const SIZES = ["S", "M", "L", "XL"] as const;

function UniformsPage() {
  const { t } = useLanguage();
  const { youth } = useAuth();
  const [selectedSize, setSelectedSize] = useState<Record<string, string>>({});
  const [ordering, setOrdering] = useState<string | null>(null);
  const [ordered, setOrdered] = useState<Set<string>>(new Set());

  const { data: skus } = useQuery({
    queryKey: ["uniform-skus"],
    queryFn: async () => {
      const { data, error } = await supabase.from("uniform_skus").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const order = async (skuId: string, name: string, price: number | null) => {
    if (!youth) return;
    const size = selectedSize[skuId] ?? "M";
    setOrdering(skuId);
    try {
      const { error } = await supabase.from("uniform_sales").insert({
        sku_id: skuId,
        item_name: name,
        youth_id: youth.id,
        youth_name: youth.full_name,
        size,
        quantity: 1,
        unit_price: price ?? 0,
      });
      if (error) throw error;

      await initiateStkPush({
        data: {
          phone: youth.phone ?? "",
          amount: price ?? 0,
          accountRef: youth.cdm_id,
          description: `CDM Merch — ${name}`,
        },
      });

      setOrdered((prev) => new Set(prev).add(skuId));
      toast.success(t("uniforms.ordered.title"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not place order.");
    } finally {
      setOrdering(null);
    }
  };

  return (
    <div className="px-5 pt-6 pb-6">
      <h1 className="text-display text-xl font-black text-foreground">{t("uniforms.title")}</h1>
      <p className="mt-1 text-[12px] text-text-3">{t("uniforms.subtitle")}</p>

      <div className="mt-5 space-y-4">
        {skus?.map((sku) => (
          <div key={sku.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <span
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: sku.swatch ?? "var(--color-bg-3)" }}
              >
                <ShoppingBag className="h-6 w-6 text-white/90" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-bold text-foreground">{sku.name}</p>
                <p className="text-[13px] font-black text-danger">Ksh {sku.unit_price ?? "—"}</p>
                <p className="text-[10px] text-text-3">{sku.in_stock} {t("uniforms.inStock")}</p>
              </div>
            </div>

            <div className="mt-3">
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-text-3">{t("uniforms.selectSize")}</p>
              <div className="flex gap-2">
                {SIZES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSelectedSize((prev) => ({ ...prev, [sku.id]: s }))}
                    className={cn(
                      "h-9 w-9 rounded-lg border text-[12px] font-bold",
                      (selectedSize[sku.id] ?? "M") === s ? "border-danger bg-danger-soft text-danger" : "border-border text-text-3",
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <Button
              className="mt-3.5 w-full"
              onClick={() => order(sku.id, sku.name, sku.unit_price)}
              disabled={ordering === sku.id}
              variant={ordered.has(sku.id) ? "outline" : "default"}
            >
              {ordered.has(sku.id) ? (
                <>
                  <Check className="h-4 w-4" /> {t("uniforms.orderNow")}
                </>
              ) : ordering === sku.id ? (
                t("common.loading")
              ) : (
                t("uniforms.orderNow")
              )}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
