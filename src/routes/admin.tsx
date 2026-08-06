import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminScopeCtx, emptyScope, fetchMyScope } from "@/lib/hooks/use-admin-scope";
import { AdminSidebar } from "@/components/admin/layout/admin-sidebar";
import { SidebarProvider } from "@/components/admin/layout/sidebar-context";
import { GlobalNavbar } from "@/components/admin/layout/topbar";

export const Route = createFileRoute("/admin")({
  beforeLoad: async ({ location }) => {
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
      <SidebarProvider>
        <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
          <AdminSidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <GlobalNavbar />
            <Outlet />
          </div>
        </div>
      </SidebarProvider>
    </AdminScopeCtx.Provider>
  );
}
