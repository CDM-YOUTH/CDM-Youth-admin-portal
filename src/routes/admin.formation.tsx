import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/formation")({
  head: () => ({
    meta: [
      { title: "Formation — CDM Youth Office" },
      { name: "description", content: "Manage Bulletins & Youth Formation Program" },
    ],
  }),
  component: FormationLayout,
});

function FormationLayout() {
  return (
    <div className="flex h-full flex-col">
      {/* Formation Section Header */}
      <div className="border-b border-border px-6 py-4">
        <h1 className="text-2xl font-bold text-text-1">Formation</h1>
        <p className="text-sm text-text-3">Manage Bulletins & Youth Formation Program</p>
      </div>

      {/* Outlet for child routes */}
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}
