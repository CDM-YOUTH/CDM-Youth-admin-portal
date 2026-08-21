import { useRegisterSW } from "virtual:pwa-register/react";
import { Download } from "lucide-react";
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Mounted only inside AdminLayout so the service worker (scoped to /admin/) is
// never registered while on /portal/* or /login.
export function AdminPwaRegister() {
  useRegisterSW({ immediate: true });
  return null;
}

export function PwaInstallButton() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => setInstallPrompt(null);

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  if (!installPrompt) return null;

  const install = async () => {
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") setInstallPrompt(null);
  };

  return (
    <button
      type="button"
      onClick={install}
      className="inline-flex h-7 items-center gap-1.5 rounded-md border border-danger/25 px-2.5 text-[10px] font-bold text-danger transition-colors hover:bg-danger-soft"
      aria-label="Install CDM Admin"
    >
      <Download className="h-3.5 w-3.5" />
      Install
    </button>
  );
}
