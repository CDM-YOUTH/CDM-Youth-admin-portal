import { useRegisterSW } from "virtual:pwa-register/react";

// Mounted only inside AdminLayout so the service worker (scoped to /admin/) is
// never registered while on /portal/* or /login.
export function AdminPwaRegister() {
  useRegisterSW({ immediate: true });
  return null;
}
