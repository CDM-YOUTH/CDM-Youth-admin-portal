import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Shield, Check, UserPlus, ChevronDown, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { apiFetch } from "@/lib/api/fetch-api";
import { fetchOrg, type OrgTree } from "@/lib/db/org";
import { fetchRoles, createRole, deleteRole, type RoleRow } from "@/lib/db/roles";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Topbar, TopbarTab } from "@/components/admin/layout/topbar";
import { Card, CardHead, CardBody, Pill } from "@/components/admin/composables/ui-bits";
import {
  usePagination,
  TablePagination,
} from "@/components/admin/composables/tables/table-pagination";

export const Route = createFileRoute("/admin/users")({
  component: UsersPage,
});

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */
type UserProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  position: string | null;
  deanery_id: string | null;
  parish_id: string | null;
  outstation_id: string | null;
  deanery: { id: string; name: string } | null;
  parish: { id: string; name: string } | null;
  outstation: { id: string; name: string } | null;
  created_at: string;
  updated_at: string;
  user_roles: { role: string }[];
};

type RolePermission = {
  id: string;
  role: string;
  module: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  scoped: boolean;
};

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */
const MODULES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "youths", label: "Youth Records" },
  { key: "enrollment", label: "Enrollment" },
  { key: "leaders", label: "Leaders" },
  { key: "events", label: "Events" },
  { key: "mission", label: "Mission Week" },
  { key: "cusa", label: "CUSA" },
  { key: "formation", label: "Formation" },
  { key: "welfare", label: "Welfare" },
  { key: "uniforms", label: "Uniforms" },
  { key: "reports", label: "Reports" },
  { key: "users", label: "User Management" },
  { key: "settings", label: "Settings" },
];

const ACTIONS = [
  { key: "can_view", label: "View" },
  { key: "can_create", label: "Create" },
  { key: "can_edit", label: "Edit" },
  { key: "can_delete", label: "Delete" },
  { key: "scoped", label: "Scoped" },
] as const;

type PillTone = "success" | "gold" | "danger" | "info" | "violet" | "neutral";
const PILL_TONES: readonly PillTone[] = ["success", "gold", "danger", "info", "violet", "neutral"];

// Roles are dynamic (src/lib/db/roles.ts) — color comes from roles.color when
// set (seeded for the 5 system roles); anything else gets a deterministic
// fallback so it's still consistent (not random) without requiring a color.
function roleTone(roleName: string, roles: RoleRow[]): PillTone {
  const color = roles.find((r) => r.name === roleName)?.color;
  if (color && (PILL_TONES as readonly string[]).includes(color)) return color as PillTone;
  let hash = 0;
  for (const ch of roleName) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return PILL_TONES[hash % PILL_TONES.length];
}

// profiles has no direct FK to user_roles (both independently reference auth.users(id)),
// so a nested `user_roles(role)` embed on a profiles select can't be resolved by
// PostgREST and silently returns nothing. Fetch role assignments separately instead.
async function fetchRolesByUserId(): Promise<Map<string, string>> {
  const { data, error } = await supabase.from("user_roles").select("user_id, role");
  if (error) throw error;
  const map = new Map<string, string>();
  for (const row of data ?? []) map.set(row.user_id, row.role);
  return map;
}

function initials(name: string | null) {
  return (name ?? "U")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
function UsersPage() {
  const [tab, setTab] = useState<"users" | "roles" | "activity">("users");

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Topbar
        title="User Management"
        tabs={
          <>
            <TopbarTab active={tab === "users"} onClick={() => setTab("users")}>
              Users
            </TopbarTab>
            <TopbarTab active={tab === "roles"} onClick={() => setTab("roles")}>
              Roles
            </TopbarTab>
            <TopbarTab active={tab === "activity"} onClick={() => setTab("activity")}>
              User Activity
            </TopbarTab>
          </>
        }
      />
      <div className="flex-1 overflow-y-auto p-4">
        {tab === "users" && <UsersTab />}
        {tab === "roles" && <RolesTab />}
        {tab === "activity" && <ActivityTab />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Users Tab                                                           */
/* ------------------------------------------------------------------ */
function UsersTab() {
  const [search, setSearch] = useState("");
  const qc = useQueryClient();

  const { data: org } = useQuery({ queryKey: ["org"], queryFn: fetchOrg });
  const { data: roles = [] } = useQuery({ queryKey: ["roles"], queryFn: fetchRoles });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [{ data, error }, rolesByUserId] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "*, deanery:deaneries(id,name), parish:parishes(id,name), outstation:outstations(id,name)",
          )
          .order("created_at", { ascending: false }),
        fetchRolesByUserId(),
      ]);
      if (error) throw error;
      return (data ?? []).map((p) => ({
        ...p,
        user_roles: rolesByUserId.has(p.id) ? [{ role: rolesByUserId.get(p.id)! }] : [],
      })) as unknown as UserProfile[];
    },
  });

  const [scopeTarget, setScopeTarget] = useState<UserProfile | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const changeRoleMut = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      // Delete any existing role(s) for this user then insert the new one
      const { error: delErr } = await (supabase as any)
        .from("user_roles")
        .delete()
        .eq("user_id", userId);
      if (delErr) throw delErr;
      const { error: insErr } = await (supabase as any)
        .from("user_roles")
        .insert({ user_id: userId, role });
      if (insErr) throw insErr;
    },
    onSuccess: () => {
      toast.success("Role updated");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const assignScopeMut = useMutation({
    mutationFn: async ({
      userId,
      deaneryId,
      parishId,
      outstationId,
    }: {
      userId: string;
      deaneryId: string | null;
      parishId: string | null;
      outstationId: string | null;
    }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ deanery_id: deaneryId, parish_id: parishId, outstation_id: outstationId })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Scope updated — user will see this on next login");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["my-scope"] });
      setScopeTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const inviteUserMut = useMutation({
    mutationFn: async (payload: {
      email: string;
      fullName: string;
      role: string;
      deaneryId: string | null;
      parishId: string | null;
      outstationId: string | null;
    }) => {
      const res = await apiFetch("/api/admin/invite-user", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Invite sent");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setInviteOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.full_name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.position?.toLowerCase().includes(q)
    );
  });

  const pagination = usePagination(filtered, 10);

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4">
        <p className="text-[12px] text-text-3">All admin and staff accounts</p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-44 rounded-lg border border-black/20 bg-white px-3 text-[11px] text-black/70 placeholder:text-gray-400 placeholder:font-normal outline-none transition-colors hover:border-gold-3/50 hover:text-black focus:border-gold-3 focus:ring-1 focus:ring-gold-3/20 focus:text-black"
          />
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-danger px-3 py-1.5 text-[11px] font-bold text-white transition-opacity hover:opacity-90"
          >
            <UserPlus className="h-3 w-3" />
            Invite User
          </button>
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-border bg-bg-2">
                <th className="px-3.5 py-2.5 text-left font-bold text-gold">User</th>
                <th className="px-3.5 py-2.5 text-left font-bold text-gold">Email</th>
                <th className="px-3.5 py-2.5 text-left font-bold text-gold">Position</th>
                <th className="px-3.5 py-2.5 text-left font-bold text-gold">Role</th>
                <th className="px-3.5 py-2.5 text-left font-bold text-gold">Data Scope</th>
                <th className="px-3.5 py-2.5 text-left font-bold text-gold">Joined</th>
                <th className="px-3.5 py-2.5 text-right font-bold text-gold">Assign Role</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={7} className="px-3.5 py-10 text-center text-text-3">
                    Loading users…
                  </td>
                </tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3.5 py-10 text-center text-text-3">
                    No users found
                  </td>
                </tr>
              )}
              {pagination.pageRows.map((user) => {
                const role = user.user_roles?.[0]?.role ?? null;
                return (
                  <tr key={user.id} className="border-b border-border last:border-0 hover:bg-bg-1">
                    <td className="px-3.5 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-gold-3 bg-bg-4 text-[9px] font-bold text-gold">
                          {initials(user.full_name)}
                        </div>
                        <span className="font-semibold text-foreground">
                          {user.full_name ?? "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-3.5 py-2.5 text-text-2">{user.email ?? "—"}</td>
                    <td className="px-3.5 py-2.5 text-text-2">{user.position ?? "—"}</td>
                    <td className="px-3.5 py-2.5">
                      {role ? (
                        <Pill tone={roleTone(role, roles)}>{role}</Pill>
                      ) : (
                        <span className="text-text-4">No role</span>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5">
                      <button
                        type="button"
                        onClick={() => setScopeTarget(user)}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-bg-2 px-2 py-1 text-[10px] font-medium text-text-2 transition hover:border-gold-3 hover:text-gold"
                      >
                        {user.outstation?.name ? (
                          <>
                            <span className="text-success">⊙</span> {user.outstation.name}
                          </>
                        ) : user.parish?.name ? (
                          <>
                            <span className="text-gold">⊙</span> {user.parish.name}
                          </>
                        ) : user.deanery?.name ? (
                          <>
                            <span className="text-info">⊙</span> {user.deanery.name}
                          </>
                        ) : (
                          <span className="text-text-4">Diocese-wide</span>
                        )}
                      </button>
                    </td>
                    <td className="px-3.5 py-2.5 text-text-3">
                      {format(new Date(user.created_at), "dd MMM yyyy")}
                    </td>
                    <td className="px-3.5 py-2.5 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            disabled={changeRoleMut.isPending}
                            className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-bg-2 px-2.5 text-[10px] font-semibold text-text-2 transition hover:border-gold-3 hover:text-gold disabled:opacity-50"
                          >
                            {role ?? "Assign"}
                            <ChevronDown className="h-3 w-3" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36">
                          {roles.map((r) => (
                            <DropdownMenuItem
                              key={r.name}
                              disabled={role === r.name}
                              onSelect={() =>
                                changeRoleMut.mutate({ userId: user.id, role: r.name })
                              }
                              className={role === r.name ? "font-bold text-gold" : ""}
                            >
                              {r.label}
                              {role === r.name && " ✓"}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <TablePagination
            page={pagination.page}
            pageSize={pagination.pageSize}
            total={pagination.total}
            totalPages={pagination.totalPages}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
          />
        )}
        <div className="border-t border-border bg-bg-2 px-3.5 py-2 text-[9px] text-text-3">
          New users are invited by email above — they'll get a link to set their password. As a
          break-glass fallback, an account can still be created directly in{" "}
          <a
            href="https://supabase.com/dashboard/project/linthhfiydxukbhjgfcz/auth/users"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gold hover:underline"
          >
            Supabase → Authentication → Users
          </a>
          , then assigned a role by running{" "}
          <code className="rounded bg-bg-4 px-1 font-mono">scripts/assign-role.sql</code>.
        </div>
      </Card>

      <ScopeDialog
        user={scopeTarget}
        org={org}
        onClose={() => setScopeTarget(null)}
        onSave={(deaneryId, parishId, outstationId) =>
          scopeTarget &&
          assignScopeMut.mutate({ userId: scopeTarget.id, deaneryId, parishId, outstationId })
        }
        isPending={assignScopeMut.isPending}
      />

      <InviteUserDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        org={org}
        roles={roles}
        isPending={inviteUserMut.isPending}
        onSubmit={(payload) => inviteUserMut.mutate(payload)}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared cascading Deanery → Parish → Outstation selects              */
/* Used by both ScopeDialog and InviteUserDialog.                      */
/* ------------------------------------------------------------------ */

function OrgScopeSelects({
  org,
  deaneryId,
  parishId,
  outstationId,
  onDeaneryChange,
  onParishChange,
  onOutstationChange,
}: {
  org?: OrgTree;
  deaneryId: string;
  parishId: string;
  outstationId: string;
  onDeaneryChange: (id: string) => void;
  onParishChange: (id: string) => void;
  onOutstationChange: (id: string) => void;
}) {
  const parishOptions = (org?.parishes ?? []).filter(
    (p) => !deaneryId || p.deanery_id === deaneryId,
  );
  const outstationOptions = (org?.outstations ?? []).filter(
    (o) => !parishId || o.parish_id === parishId,
  );

  return (
    <>
      <label className="block space-y-1 text-[10px] font-bold uppercase tracking-wide text-text-3">
        <span>Deanery (optional)</span>
        <select
          value={deaneryId}
          onChange={(e) => {
            onDeaneryChange(e.target.value);
            onParishChange("");
            onOutstationChange("");
          }}
          className="w-full rounded-lg border border-border bg-bg-2 px-3 py-2 text-[11px] text-foreground outline-none transition focus:border-gold-3"
        >
          <option value="">— Diocese-wide (no restriction) —</option>
          {(org?.deaneries ?? []).map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1 text-[10px] font-bold uppercase tracking-wide text-text-3">
        <span>Parish (optional — narrows to parish level)</span>
        <select
          value={parishId}
          disabled={!deaneryId}
          onChange={(e) => {
            onParishChange(e.target.value);
            onOutstationChange("");
          }}
          className="w-full rounded-lg border border-border bg-bg-2 px-3 py-2 text-[11px] text-foreground outline-none transition focus:border-gold-3 disabled:opacity-40"
        >
          <option value="">— All parishes in deanery —</option>
          {parishOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1 text-[10px] font-bold uppercase tracking-wide text-text-3">
        <span>Outstation (optional — narrows to outstation level)</span>
        <select
          value={outstationId}
          disabled={!parishId}
          onChange={(e) => onOutstationChange(e.target.value)}
          className="w-full rounded-lg border border-border bg-bg-2 px-3 py-2 text-[11px] text-foreground outline-none transition focus:border-gold-3 disabled:opacity-40"
        >
          <option value="">— All outstations in parish —</option>
          {outstationOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Scope assignment dialog                                             */
/* ------------------------------------------------------------------ */

function ScopeDialog({
  user,
  org,
  onClose,
  onSave,
  isPending,
}: {
  user: UserProfile | null;
  org?: OrgTree;
  onClose: () => void;
  onSave: (deaneryId: string | null, parishId: string | null, outstationId: string | null) => void;
  isPending: boolean;
}) {
  const [deaneryId, setDeaneryId] = useState<string>("");
  const [parishId, setParishId] = useState<string>("");
  const [outstationId, setOutstationId] = useState<string>("");

  useEffect(() => {
    if (user) {
      setDeaneryId(user.deanery_id ?? "");
      setParishId(user.parish_id ?? "");
      setOutstationId(user.outstation_id ?? "");
    }
  }, [user]);

  const hasScope = !!(deaneryId || parishId || outstationId);
  const scopeLabel = outstationId
    ? ((org?.outstations ?? []).find((o) => o.id === outstationId)?.name ?? "selected outstation")
    : parishId
      ? ((org?.parishes ?? []).find((p) => p.id === parishId)?.name ?? "selected parish")
      : ((org?.deaneries ?? []).find((d) => d.id === deaneryId)?.name ?? "selected deanery");

  return (
    <Dialog
      open={!!user}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-md border-border bg-white text-foreground">
        <DialogHeader>
          <DialogTitle className="text-display text-xl font-black text-gold">
            Assign Data Scope
          </DialogTitle>
          <DialogDescription className="text-[12px] text-text-3">
            <strong>{user?.full_name ?? user?.email}</strong> — Restricts all queries to the
            selected deanery, parish, or outstation. Leave blank for diocese-wide access.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <OrgScopeSelects
            org={org}
            deaneryId={deaneryId}
            parishId={parishId}
            outstationId={outstationId}
            onDeaneryChange={setDeaneryId}
            onParishChange={setParishId}
            onOutstationChange={setOutstationId}
          />

          {hasScope && (
            <div className="rounded-lg border border-info/30 bg-info-soft px-3 py-2 text-[11px] text-text-1">
              This user will <strong>only see data</strong> from {scopeLabel} when they log in.
            </div>
          )}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border bg-bg-3 px-3 py-2 text-[11px] font-bold text-text-2"
          >
            Cancel
          </button>
          {hasScope && (
            <button
              type="button"
              onClick={() => onSave(null, null, null)}
              disabled={isPending}
              className="rounded-lg border border-border bg-bg-3 px-3 py-2 text-[11px] font-bold text-text-2 hover:border-danger hover:text-danger disabled:opacity-50"
            >
              Clear scope
            </button>
          )}
          <button
            type="button"
            onClick={() => onSave(deaneryId || null, parishId || null, outstationId || null)}
            disabled={isPending}
            className="rounded-lg bg-primary px-4 py-2 text-[11px] font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {isPending ? "Saving…" : "Save scope"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Invite user dialog                                                  */
/* ------------------------------------------------------------------ */

function InviteUserDialog({
  open,
  onOpenChange,
  org,
  roles,
  isPending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  org?: OrgTree;
  roles: RoleRow[];
  isPending: boolean;
  onSubmit: (payload: {
    email: string;
    fullName: string;
    role: string;
    deaneryId: string | null;
    parishId: string | null;
    outstationId: string | null;
  }) => void;
}) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("user");
  const [deaneryId, setDeaneryId] = useState("");
  const [parishId, setParishId] = useState("");
  const [outstationId, setOutstationId] = useState("");

  useEffect(() => {
    if (open) {
      setEmail("");
      setFullName("");
      setRole("user");
      setDeaneryId("");
      setParishId("");
      setOutstationId("");
    }
  }, [open]);

  const handleSubmit = () => {
    if (!email.trim()) {
      toast.error("Enter an email address");
      return;
    }
    if (!fullName.trim()) {
      toast.error("Enter a full name");
      return;
    }
    onSubmit({
      email: email.trim(),
      fullName: fullName.trim(),
      role,
      deaneryId: deaneryId || null,
      parishId: parishId || null,
      outstationId: outstationId || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-border bg-white text-foreground">
        <DialogHeader>
          <DialogTitle className="text-display text-xl font-black text-gold">
            Invite User
          </DialogTitle>
          <DialogDescription className="text-[12px] text-text-3">
            They'll receive an email with a link to set their password and sign in.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <label className="block space-y-1 text-[10px] font-bold uppercase tracking-wide text-text-3">
            <span>Full name *</span>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Grace Wanjiku"
            />
          </label>

          <label className="block space-y-1 text-[10px] font-bold uppercase tracking-wide text-text-3">
            <span>Email *</span>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@cdmyouth.co.ke"
            />
          </label>

          <label className="block space-y-1 text-[10px] font-bold uppercase tracking-wide text-text-3">
            <span>Role *</span>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.name} value={r.name}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <OrgScopeSelects
            org={org}
            deaneryId={deaneryId}
            parishId={parishId}
            outstationId={outstationId}
            onDeaneryChange={setDeaneryId}
            onParishChange={setParishId}
            onOutstationChange={setOutstationId}
          />
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg border border-border bg-bg-3 px-3 py-2 text-[11px] font-bold text-text-2"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="rounded-lg bg-primary px-4 py-2 text-[11px] font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {isPending ? "Sending…" : "Send invite"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Roles Tab                                                           */
/* ------------------------------------------------------------------ */
function RolesTab() {
  const [selectedRole, setSelectedRole] = useState("office");
  const [createOpen, setCreateOpen] = useState(false);
  const qc = useQueryClient();

  const { data: roles = [] } = useQuery({ queryKey: ["roles"], queryFn: fetchRoles });

  // If the selected role gets deleted (or hasn't loaded yet), fall back to the first available.
  useEffect(() => {
    if (roles.length === 0) return;
    if (!roles.some((r) => r.name === selectedRole)) {
      setSelectedRole(roles[0].name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roles]);

  const createRoleMut = useMutation({
    mutationFn: createRole,
    onSuccess: (created) => {
      toast.success("Role created");
      qc.invalidateQueries({ queryKey: ["roles"] });
      setSelectedRole(created.name);
      setCreateOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteRoleMut = useMutation({
    mutationFn: deleteRole,
    onSuccess: () => {
      toast.success("Role deleted");
      qc.invalidateQueries({ queryKey: ["roles"] });
    },
    onError: (e: Error) => {
      const code = (e as Error & { code?: string }).code;
      if (code === "23503") {
        toast.error("Cannot delete — some users still have this role. Reassign them first.");
      } else {
        toast.error(e.message);
      }
    },
  });

  const { data: permissions = [], isLoading } = useQuery({
    queryKey: ["role-permissions", selectedRole],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("role_permissions")
        .select("*")
        .eq("role", selectedRole);
      if (error) throw error;
      return (data ?? []) as unknown as RolePermission[];
    },
  });

  const toggle = useMutation({
    mutationFn: async ({
      module,
      action,
      value,
    }: {
      module: string;
      action: string;
      value: boolean;
    }) => {
      const existing = permissions.find((p) => p.module === module);
      if (existing) {
        const { error } = await (supabase as any)
          .from("role_permissions")
          .update({ [action]: value })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("role_permissions").insert({
          role: selectedRole,
          module,
          [action]: value,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["role-permissions", selectedRole] }),
  });

  const perm = (moduleKey: string) => permissions.find((p) => p.module === moduleKey);

  const roleInfo = roles.find((r) => r.name === selectedRole);

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4">
        <p className="text-[12px] text-text-3">
          Define what each role can access across every module
        </p>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1.5 rounded-lg bg-danger px-3 py-1.5 text-[11px] font-bold text-white transition-opacity hover:opacity-90"
        >
          <Plus className="h-3 w-3" />
          New Role
        </button>
      </div>

      {/* Role selector */}
      <div className="mb-4 flex flex-wrap gap-2">
        {roles.map((r) => (
          <div key={r.name} className="group relative">
            <button
              onClick={() => setSelectedRole(r.name)}
              className={`rounded-xl border-2 px-4 py-2 pr-3 text-[11px] font-bold transition-all ${
                selectedRole === r.name
                  ? "border-danger bg-danger text-white shadow-md"
                  : "border-gold/30 bg-white text-gold-3 hover:border-gold/60"
              }`}
            >
              {r.label}
            </button>
            {!r.is_system && (
              <button
                type="button"
                title={`Delete ${r.label}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Delete the "${r.label}" role?`)) deleteRoleMut.mutate(r.name);
                }}
                disabled={deleteRoleMut.isPending}
                className={`absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full border transition disabled:opacity-50 ${
                  selectedRole === r.name
                    ? "border-white bg-white text-danger"
                    : "border-border bg-white text-text-3 opacity-0 group-hover:opacity-100 hover:border-danger hover:text-danger"
                }`}
              >
                <Trash2 className="h-2.5 w-2.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Role description card */}
      {roleInfo && (
        <Card className="mb-4">
          <CardBody className="flex items-center gap-3 py-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-danger-soft">
              <Shield className="h-4 w-4 text-danger" />
            </div>
            <div>
              <div className="text-[12px] font-bold text-danger capitalize">
                {roleInfo.label} role
              </div>
              <div className="text-[10px] text-text-3">{roleInfo.description}</div>
            </div>
            <div className="ml-auto">
              <Pill tone={roleTone(selectedRole, roles)}>{selectedRole}</Pill>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Permission matrix */}
      <Card>
        <CardHead
          title="Permission Matrix"
          subtitle={`Toggle what the '${selectedRole}' role can do in each module — "Scoped" restricts it to the user's assigned deanery/parish/outstation`}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-border bg-bg-2">
                <th className="w-44 px-3.5 py-2.5 text-left font-bold text-gold">Module</th>
                {ACTIONS.map((a) => (
                  <th key={a.key} className="w-20 px-3.5 py-2.5 text-center font-bold text-gold">
                    {a.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={ACTIONS.length + 1} className="px-3.5 py-8 text-center text-text-3">
                    Loading…
                  </td>
                </tr>
              ) : (
                MODULES.map((mod) => {
                  const p = perm(mod.key);
                  return (
                    <tr
                      key={mod.key}
                      className="border-b border-border last:border-0 hover:bg-bg-1"
                    >
                      <td className="px-3.5 py-2 font-medium text-foreground">{mod.label}</td>
                      {ACTIONS.map((action) => {
                        const checked = p ? Boolean(p[action.key as keyof RolePermission]) : false;
                        return (
                          <td key={action.key} className="px-3.5 py-2 text-center">
                            <button
                              disabled={toggle.isPending}
                              onClick={() =>
                                toggle.mutate({
                                  module: mod.key,
                                  action: action.key,
                                  value: !checked,
                                })
                              }
                              className={`inline-flex h-5 w-5 items-center justify-center rounded transition-colors disabled:opacity-50 ${
                                checked
                                  ? "bg-success text-white hover:bg-success/80"
                                  : "border border-border bg-bg-3 text-transparent hover:border-gold/50"
                              }`}
                            >
                              <Check className="h-3 w-3" />
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <CreateRoleDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        isPending={createRoleMut.isPending}
        onSubmit={(input) => createRoleMut.mutate(input)}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Create role dialog                                                  */
/* ------------------------------------------------------------------ */

const NAME_PATTERN = /^[a-z][a-z0-9_]*$/;

function CreateRoleDialog({
  open,
  onOpenChange,
  isPending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  isPending: boolean;
  onSubmit: (input: { name: string; label: string; description: string; color: string }) => void;
}) {
  const [name, setName] = useState("");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<PillTone>("info");

  useEffect(() => {
    if (open) {
      setName("");
      setLabel("");
      setDescription("");
      setColor("info");
    }
  }, [open]);

  const handleSubmit = () => {
    const slug = name.trim().toLowerCase();
    if (!NAME_PATTERN.test(slug)) {
      toast.error(
        "Role name must be lowercase letters, numbers, and underscores, starting with a letter.",
      );
      return;
    }
    if (!label.trim()) {
      toast.error("Enter a display label");
      return;
    }
    onSubmit({ name: slug, label: label.trim(), description: description.trim(), color });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-border bg-white text-foreground">
        <DialogHeader>
          <DialogTitle className="text-display text-xl font-black text-gold">New Role</DialogTitle>
          <DialogDescription className="text-[12px] text-text-3">
            Starts with zero permissions — use the matrix below to grant access per module.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <label className="block space-y-1 text-[10px] font-bold uppercase tracking-wide text-text-3">
            <span>Name (internal, permanent) *</span>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="regional_coordinator"
            />
          </label>

          <label className="block space-y-1 text-[10px] font-bold uppercase tracking-wide text-text-3">
            <span>Display label *</span>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Regional Coordinator"
            />
          </label>

          <label className="block space-y-1 text-[10px] font-bold uppercase tracking-wide text-text-3">
            <span>Description</span>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this role is for"
            />
          </label>

          <label className="block space-y-1 text-[10px] font-bold uppercase tracking-wide text-text-3">
            <span>Color</span>
            <div className="flex gap-2">
              {PILL_TONES.map((tone) => (
                <button
                  key={tone}
                  type="button"
                  onClick={() => setColor(tone)}
                  className={`h-7 w-7 rounded-full border-2 transition ${
                    color === tone ? "border-foreground" : "border-transparent"
                  }`}
                  aria-label={tone}
                >
                  <Pill tone={tone}>&nbsp;</Pill>
                </button>
              ))}
            </div>
          </label>
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg border border-border bg-bg-3 px-3 py-2 text-[11px] font-bold text-text-2"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="rounded-lg bg-primary px-4 py-2 text-[11px] font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {isPending ? "Creating…" : "Create role"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Activity Tab                                                        */
/* ------------------------------------------------------------------ */
function ActivityTab() {
  const { data: roles = [] } = useQuery({ queryKey: ["roles"], queryFn: fetchRoles });
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users-activity"],
    queryFn: async () => {
      const [{ data, error }, rolesByUserId] = await Promise.all([
        supabase.from("profiles").select("*").order("updated_at", { ascending: false }),
        fetchRolesByUserId(),
      ]);
      if (error) throw error;
      return (data ?? []).map((p) => ({
        ...p,
        user_roles: rolesByUserId.has(p.id) ? [{ role: rolesByUserId.get(p.id)! }] : [],
      })) as unknown as UserProfile[];
    },
  });

  const pagination = usePagination(users, 10);

  return (
    <div>
      <p className="mb-5 text-[12px] text-text-3">Account creation and last update timestamps</p>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-border bg-bg-2">
                <th className="px-3.5 py-2.5 text-left font-bold text-gold">User</th>
                <th className="px-3.5 py-2.5 text-left font-bold text-gold">Role</th>
                <th className="px-3.5 py-2.5 text-left font-bold text-gold">Account Created</th>
                <th className="px-3.5 py-2.5 text-left font-bold text-gold">Last Updated</th>
                <th className="px-3.5 py-2.5 text-left font-bold text-gold">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={5} className="px-3.5 py-10 text-center text-text-3">
                    Loading…
                  </td>
                </tr>
              )}
              {!isLoading && users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3.5 py-10 text-center text-text-3">
                    No users found
                  </td>
                </tr>
              )}
              {pagination.pageRows.map((user) => {
                const role = user.user_roles?.[0]?.role ?? null;
                return (
                  <tr key={user.id} className="border-b border-border last:border-0 hover:bg-bg-1">
                    <td className="px-3.5 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gold-3 bg-bg-4 text-[8px] font-bold text-gold">
                          {initials(user.full_name)}
                        </div>
                        <div>
                          <div className="font-medium text-foreground">{user.full_name ?? "—"}</div>
                          {user.email && <div className="text-[9px] text-text-3">{user.email}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3.5 py-2.5">
                      {role ? (
                        <Pill tone={roleTone(role, roles)}>{role}</Pill>
                      ) : (
                        <span className="text-text-4">—</span>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 text-text-2">
                      {format(new Date(user.created_at), "dd MMM yyyy · HH:mm")}
                    </td>
                    <td className="px-3.5 py-2.5 text-text-2">
                      {format(new Date(user.updated_at), "dd MMM yyyy · HH:mm")}
                    </td>
                    <td className="px-3.5 py-2.5">
                      <span className="flex items-center gap-1.5 text-[10px] font-semibold text-success">
                        <span className="h-1.5 w-1.5 rounded-full bg-success" />
                        Active
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {users.length > 0 && (
          <TablePagination
            page={pagination.page}
            pageSize={pagination.pageSize}
            total={pagination.total}
            totalPages={pagination.totalPages}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
          />
        )}
      </Card>
    </div>
  );
}
