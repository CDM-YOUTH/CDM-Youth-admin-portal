import { useEffect } from "react";
import {
  Outlet,
  createFileRoute,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AdminScopeCtx, emptyScope, fetchMyScope } from "@/lib/hooks/use-admin-scope";
import { MODULE_BY_PATH, useModuleAccess } from "@/lib/hooks/use-module-access";
import { AdminSidebar } from "@/components/admin/layout/admin-sidebar";
import { AdminPwaRegister } from "@/components/admin/layout/pwa-register";
import { SidebarProvider } from "@/components/admin/layout/sidebar-context";
import { GlobalNavbar } from "@/components/admin/layout/topbar";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ name: "theme-color", content: "#d01d21" }],
    links: [
      { rel: "manifest", href: "/admin-manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  }),
  beforeLoad: async ({ location }) => {
    // Skip on the server — localStorage doesn't exist there, so getSession()
    // always returns null and would redirect every SSR page load to /login.
    // The client-side check fires immediately after hydration.
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({
        to: "/login",
        search: { redirect: location.pathname },
      });
    }
  },
  component: AdminLayout,
});

function AdminLayout() {
  const { data: scope = emptyScope } = useQuery({
    queryKey: ["my-scope"],
    queryFn: fetchMyScope,
    staleTime: 5 * 60_000,
  });

  return (
    <AdminScopeCtx.Provider value={scope}>
      <AdminPwaRegister />
      <SidebarProvider>
        <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
          <AdminSidebar />
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <GlobalNavbar />
            <ModuleGuard>
              <Outlet />
            </ModuleGuard>
          </div>
        </div>
      </SidebarProvider>
    </AdminScopeCtx.Provider>
  );
}

// Blocks direct navigation to a module the current role can't view.
// UX-layer defense-in-depth — the sidebar already hides these links;
// the real security boundary is RLS + the API's applyCallerScope checks.
function ModuleGuard({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { data: access, isSuccess } = useModuleAccess();

  useEffect(() => {
    if (!isSuccess) return;
    const module = MODULE_BY_PATH[pathname];
    if (module && access[module]?.canView === false) {
      toast.error("You don't have access to that section");
      navigate({ to: "/admin/dashboard" });
    }
  }, [pathname, isSuccess, access, navigate]);

  return <>{children}</>;
}
