import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CalendarDays, GraduationCap, UserRound, HeartHandshake, Compass, Shirt, ChevronDown } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n/context";
import { supabase } from "@/integrations/supabase/client";
import type { Enums } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authed/notifications")({
  head: () => ({ meta: [{ title: "Notifications — CDM Youth Portal" }] }),
  component: NotificationsPage,
});

type Filter = "all" | "unread" | "events";

const CATEGORY_ICON: Record<Enums<"notification_category">, typeof Bell> = {
  formation: GraduationCap,
  event: CalendarDays,
  account: UserRound,
  enrollment: Bell,
  mission: Compass,
  welfare: HeartHandshake,
  uniform: Shirt,
  general: Bell,
};

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function NotificationsPage() {
  const { t } = useLanguage();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: notifications } = useQuery({
    queryKey: ["notifications", session?.user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", session!.user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!session?.user.id,
  });

  const filtered = (notifications ?? []).filter((n) => {
    if (filter === "unread") return !n.is_read;
    if (filter === "events") return n.category === "event";
    return true;
  });

  const markRead = async (id: string, isRead: boolean) => {
    setExpandedId((cur) => (cur === id ? null : id));
    if (isRead) return;
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["notifications", session?.user.id] });
    queryClient.invalidateQueries({ queryKey: ["unread-notification-count", session?.user.id] });
  };

  return (
    <div className="px-5 pt-6">
      <h1 className="text-display text-xl font-black text-foreground">{t("notifications.title")}</h1>
      <p className="mt-1 text-[12px] text-text-3">{t("notifications.subtitle")}</p>

      <div className="mt-4 flex gap-2">
        {(["all", "unread", "events"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-[11px] font-bold",
              filter === f ? "bg-danger text-white" : "bg-muted text-text-3",
            )}
          >
            {t(`notifications.filter.${f}`)}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-2.5 pb-6">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center py-16 text-center">
            <Bell className="mb-3 h-8 w-8 text-text-4" />
            <p className="text-[12px] text-text-3">{t("notifications.empty")}</p>
          </div>
        )}
        {filtered.map((n) => {
          const Icon = CATEGORY_ICON[n.category] ?? Bell;
          const expanded = expandedId === n.id;
          return (
            <button
              key={n.id}
              onClick={() => markRead(n.id, n.is_read)}
              className="flex w-full items-start gap-3 rounded-2xl border border-border bg-card p-3.5 text-left"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-info-soft text-info">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-bold uppercase tracking-wide text-gold-3">{n.category}</span>
                  <span className="text-[10px] text-text-4">· {timeAgo(n.created_at)}</span>
                  {!n.is_read && <span className="h-1.5 w-1.5 rounded-full bg-danger" />}
                </div>
                <p className="mt-0.5 text-[13px] font-bold text-foreground">{n.title}</p>
                {n.body && (
                  <p className={cn("mt-0.5 text-[11px] text-text-3", !expanded && "truncate")}>{n.body}</p>
                )}
              </div>
              {n.body && (
                <ChevronDown className={cn("h-4 w-4 shrink-0 text-text-4 transition-transform", expanded && "rotate-180")} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
