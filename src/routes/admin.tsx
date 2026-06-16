import { Outlet, createFileRoute } from "@tanstack/react-router";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { SidebarProvider } from "@/components/admin/sidebar-context";
import { GlobalNavbar } from "@/components/admin/topbar";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
        <AdminSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <GlobalNavbar />
          <Outlet />
        </div>
      </div>
    </SidebarProvider>
  );
}
