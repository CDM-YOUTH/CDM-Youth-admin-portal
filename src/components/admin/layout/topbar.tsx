import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import cdmLogo from "@/assets/cdm-logo.jpeg";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile } from "@/lib/db/youth-records/profiles";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0]! + parts[parts.length - 1][0]!).toUpperCase();
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return "?";
}

function useCurrentUser() {
  return useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;
      const profile = await getMyProfile().catch(() => null);
      const name = profile?.full_name || user.email || "";
      return { email: user.email ?? "", name, position: profile?.position ?? null };
    },
    staleTime: 5 * 60_000,
  });
}

/* ------------------------------------------------------------------ */
/* UserMenu — avatar button + dropdown + confirm dialog                */
/* ------------------------------------------------------------------ */

export function UserMenu() {
  const navigate = useNavigate();
  const { data: user } = useCurrentUser();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const initials = user?.name ? getInitials(user.name) : "?";
  const displayName = user?.name || "—";
  const showEmail = user?.email && user.email !== user.name;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    await navigate({ to: "/" });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="User menu"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white ring-2 ring-danger/25 transition-opacity hover:opacity-85 focus:outline-none"
          >
            {initials}
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" sideOffset={8} className="w-56 border border-black/10 shadow-lg">
          {/* User info header */}
          <DropdownMenuLabel className="flex items-center gap-2.5 pb-2.5 pt-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white">
              {initials}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-[12px] font-bold text-black">{displayName}</div>
              {showEmail && (
                <div className="truncate text-[10px] font-normal text-gray-400">{user!.email}</div>
              )}
              {user?.position && (
                <div className="truncate text-[10px] font-normal text-gray-400">{user.position}</div>
              )}
            </div>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onSelect={() => setConfirmOpen(true)}
            className="cursor-pointer gap-2 text-danger focus:bg-danger-soft/60 focus:text-danger"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Confirm dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="max-w-sm bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[16px] font-black text-foreground">
              Sign out?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[12px] text-text-2">
              Are you sure you want to log out? You will need to sign in again to access the
              dashboard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-[11px]">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSignOut}
              className="h-8 bg-danger text-[11px] font-bold text-white hover:bg-danger/90"
            >
              Yes, sign out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* GlobalNavbar — rendered once at admin layout level                  */
/* ------------------------------------------------------------------ */

export function GlobalNavbar() {
  return (
    <div className="flex h-12 shrink-0 items-center border-b border-border bg-card px-5">
      {/* Logo + brand */}
      <div className="flex items-center gap-2.5">
        <img
          src={cdmLogo}
          alt="CDM Youth Office"
          className="h-8 w-8 shrink-0 rounded-full object-cover"
        />
        <div className="leading-tight">
          <div className="text-[11px] font-bold text-foreground">Youth Office</div>
          <div className="text-[9px] text-text-3">Diocese of Murang'a</div>
        </div>
      </div>

      {/* Right: status badges + user */}
      <div className="ml-auto flex items-center gap-2.5">
        <span className="rounded-full border border-bg-4 bg-bg-3 px-2.5 py-[3px] text-[9px] font-bold text-success">
          Year 2026
        </span>
        <span className="flex items-center gap-1 rounded-full border border-border bg-bg-3 px-2.5 py-[3px] text-[9px] text-text-3">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          Live
        </span>
        <UserMenu />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Topbar — per-page sub-header (title · tabs · actions)               */
/* ------------------------------------------------------------------ */

export function Topbar({
  title,
  description,
  tabs,
  action,
}: {
  title: string;
  description?: string;
  tabs?: ReactNode;
  action?: ReactNode;
}) {
  if (tabs) {
    return (
      <div className="flex min-h-12 shrink-0 items-center gap-0 border-b border-border bg-card px-5">
        <div className="mr-4 shrink-0 text-[13px] font-extrabold text-foreground">
          {title}
        </div>
        <div className="flex flex-1 gap-0">{tabs}</div>
        {action && <div className="ml-auto flex items-center gap-2.5">{action}</div>}
      </div>
    );
  }

  return (
    <div className="flex shrink-0 items-center justify-between border-b border-border bg-card px-5 py-3.5">
      <div>
        <div className="text-[17px] font-extrabold leading-tight text-danger">{title}</div>
        {description && (
          <div className="mt-0.5 text-[11px] text-text-3">{description}</div>
        )}
      </div>
      {action && (
        <div className="flex items-center gap-2">{action}</div>
      )}
    </div>
  );
}

export function TopbarTab({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex h-12 items-center whitespace-nowrap border-b-2 px-3.5 text-[11px] font-semibold transition-colors ${
        active
          ? "border-danger text-danger"
          : "border-transparent text-text-3 hover:text-text-1"
      }`}
    >
      {children}
    </button>
  );
}

export function TopbarButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg bg-primary px-3.5 py-1.5 text-[11px] font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
    >
      {children}
    </button>
  );
}
