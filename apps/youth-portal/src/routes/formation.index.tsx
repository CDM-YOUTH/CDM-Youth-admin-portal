import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Headphones, Video, Image as ImageIcon, Bookmark, Clock } from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { TopBar } from "@/components/top-bar";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n/context";
import { supabase } from "@/integrations/supabase/client";
import type { Enums } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/formation/")({
  head: () => ({ meta: [{ title: "Formation Library — CDM Youth Portal" }] }),
  component: FormationPage,
});

const KIND_ICON: Record<Enums<"formation_kind">, typeof FileText> = {
  PDF: FileText,
  Audio: Headphones,
  Video: Video,
  Image: ImageIcon,
  Other: FileText,
};

function FormationPage() {
  const { t } = useLanguage();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [tag, setTag] = useState("All");

  const { data: items } = useQuery({
    queryKey: ["formation-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("formation_items")
        .select("*")
        .eq("published", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: bookmarks } = useQuery({
    queryKey: ["formation-bookmarks", session?.user.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("formation_bookmarks").select("formation_id").eq("user_id", session!.user.id);
      if (error) throw error;
      return new Set(data.map((b) => b.formation_id));
    },
    enabled: !!session?.user.id,
  });

  const tags = ["All", ...new Set((items ?? []).flatMap((i) => i.tags))];
  const filtered = (items ?? []).filter((i) => tag === "All" || i.tags.includes(tag));

  const toggleBookmark = async (formationId: string) => {
    if (!session?.user.id) return;
    const isBookmarked = bookmarks?.has(formationId);
    if (isBookmarked) {
      await supabase.from("formation_bookmarks").delete().eq("user_id", session.user.id).eq("formation_id", formationId);
    } else {
      await supabase.from("formation_bookmarks").insert({ user_id: session.user.id, formation_id: formationId });
    }
    queryClient.invalidateQueries({ queryKey: ["formation-bookmarks", session.user.id] });
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background">
      <TopBar />
      <div className="flex-1 px-5 pt-6">
        <h1 className="text-display text-xl font-black text-foreground">{t("formation.title")}</h1>
        <p className="mt-1 text-[12px] text-text-3">{t("formation.subtitle")}</p>

        <div className="mt-4 flex gap-2 overflow-x-auto">
          {tags.map((tg) => (
            <button
              key={tg}
              onClick={() => setTag(tg)}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-1.5 text-[11px] font-bold",
                tag === tg ? "bg-danger text-white" : "bg-muted text-text-3",
              )}
            >
              {tg}
            </button>
          ))}
        </div>

        <div className="mt-5 space-y-2.5 pb-6">
          {filtered.length === 0 && <p className="mt-8 text-center text-[12px] text-text-3">{t("formation.empty")}</p>}
          {filtered.map((item) => {
            const Icon = KIND_ICON[item.kind];
            const bookmarked = bookmarks?.has(item.id) ?? false;
            return (
              <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5">
                <Link
                  to="/formation/$itemId"
                  params={{ itemId: item.id }}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-info-soft text-info">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="text-[9px] font-bold uppercase tracking-wide text-gold-3">{item.kind}</span>
                    <p className="truncate text-[13px] font-bold text-foreground">{item.title}</p>
                    <div className="mt-0.5 flex items-center gap-1 text-[11px] text-text-3">
                      {item.duration && (
                        <>
                          <Clock className="h-3 w-3" /> {item.duration}
                        </>
                      )}
                    </div>
                  </div>
                </Link>
                <button onClick={() => toggleBookmark(item.id)} className="shrink-0">
                  <Bookmark className={cn("h-4.5 w-4.5", bookmarked ? "fill-danger text-danger" : "text-text-4")} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
