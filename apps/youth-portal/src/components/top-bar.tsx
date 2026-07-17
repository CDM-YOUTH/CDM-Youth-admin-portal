import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import cdmLogo from "@/assets/cdm-logo.jpeg";

export function TopBar() {
  const { status, youth, session } = useAuth();
  const authed = status === "authed";

  const { data: unreadCount } = useQuery({
    queryKey: ["unread-notification-count", session?.user.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", session!.user.id)
        .eq("is_read", false);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!session?.user.id,
  });

  return (
    <div className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-background/95 px-5 py-3 backdrop-blur">
      <Link to={authed ? "/home" : "/"} className="shrink-0">
        <img src={cdmLogo} alt="CDM" className="h-8 w-8 object-contain" />
      </Link>
      <div className="flex-1" />
      <Link
        to={authed ? "/notifications" : "/login"}
        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted"
      >
        <Bell className="h-4 w-4 text-text-2" />
        {!!unreadCount && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-danger" />}
      </Link>
      <Link
        to={authed ? "/profile" : "/login"}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-danger-soft text-[13px] font-black text-danger"
      >
        {authed ? youth?.full_name?.[0]?.toUpperCase() ?? "?" : "?"}
      </Link>
    </div>
  );
}
