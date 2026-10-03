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
      {/* Outlet for child routes */}
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}
