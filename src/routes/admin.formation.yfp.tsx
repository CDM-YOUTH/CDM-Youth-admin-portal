import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/formation/yfp")({
  component: YFPLayout,
});

function YFPLayout() {
  return <Outlet />;
}
