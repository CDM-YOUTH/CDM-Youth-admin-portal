import { Outlet, createFileRoute } from "@tanstack/react-router";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <AdminSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
