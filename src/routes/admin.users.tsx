import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Shield, Check, ExternalLink, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchOrg, type OrgTree } from "@/lib/db/org";
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
import { Topbar, TopbarTab } from "@/components/admin/layout/topbar";
import {
  Card,
  CardHead,
  CardBody,
  Pill,
} from "@/components/admin/composables/ui-bits";
import { usePagination, TablePagination } from "@/components/admin/composables/tables/table-pagination";

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
  deanery: { id: string; name: string } | null;
  parish: { id: string; name: string } | null;
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
};

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */
const MODULES = [
  { key: "dashboard",  label: "Dashboard" },
  { key: "youths",     label: "Youth Records" },
  { key: "enrollment", label: "Enrollment" },
  { key: "events",     label: "Events" },
  { key: "mission",    label: "Mission Week" },
  { key: "cusa",       label: "CUSA" },
  { key: "formation",  label: "Formation" },
  { key: "welfare",    label: "Welfare" },
  { key: "uniforms",   label: "Uniforms" },
  { key: "reports",    label: "Reports" },
  { key: "users",      label: "User Management" },
  { key: "settings",   label: "Settings" },
];

const ROLES = [
  {
    value: "office",
    label: "Office",
    description: "Full access — manages all modules and users",
  },
  {
    value: "admin",
    label: "Admin",
    description: "System administrator with complete privileges",
  },
  {
    value: "moderator",
    label: "Moderator",
    description: "View and edit content; cannot delete or manage users",
  },
  {
    value: "user",
    label: "User",
    description: "View-only access to non-sensitive modules",
  },
];

const ACTIONS = [
  { key: "can_view",   label: "View" },
  { key: "can_create", label: "Create" },
  { key: "can_edit",   label: "Edit" },
  { key: "can_delete", label: "Delete" },
] as const;

function roleTone(role: string): "danger" | "gold" | "info" | "neutral" {
  if (role === "office") return "danger";
  if (role === "admin") return "gold";
  if (role === "moderator") return "info";
  return "neutral";
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
            <TopbarTab
              active={tab === "activity"}
              onClick={() => setTab("activity")}
            >
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

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*, user_roles(role), deanery:deaneries(id,name), parish:parishes(id,name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as UserProfile[];
    },
  });

  const [scopeTarget, setScopeTarget] = useState<UserProfile | null>(null);

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
    mutationFn: async ({ userId, deaneryId, parishId }: { userId: string; deaneryId: string | null; parishId: string | null }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ deanery_id: deaneryId, parish_id: parishId })
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
          <a
            href="https://supabase.com/dashboard/project/linthhfiydxukbhjgfcz/auth/users"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg bg-danger px-3 py-1.5 text-[11px] font-bold text-white transition-opacity hover:opacity-90"
          >
            <ExternalLink className="h-3 w-3" />
            Add User
          </a>
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
                  <tr
                    key={user.id}
                    className="border-b border-border last:border-0 hover:bg-bg-1"
                  >
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
                    <td className="px-3.5 py-2.5 text-text-2">
                      {user.email ?? "—"}
                    </td>
                    <td className="px-3.5 py-2.5 text-text-2">
                      {user.position ?? "—"}
                    </td>
                    <td className="px-3.5 py-2.5">
                      {role ? (
                        <Pill tone={roleTone(role)}>{role}</Pill>
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
                        {user.parish?.name
                          ? <><span className="text-gold">⊙</span> {user.parish.name}</>
                          : user.deanery?.name
                          ? <><span className="text-info">⊙</span> {user.deanery.name}</>
                          : <span className="text-text-4">Diocese-wide</span>}
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
                          {ROLES.map((r) => (
                            <DropdownMenuItem
                              key={r.value}
                              disabled={role === r.value}
                              onSelect={() =>
                                changeRoleMut.mutate({ userId: user.id, role: r.value })
                              }
                              className={role === r.value ? "font-bold text-gold" : ""}
                            >
                              {r.label}
                              {role === r.value && " ✓"}
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
          To add new users go to{" "}
          <a
            href="https://supabase.com/dashboard/project/linthhfiydxukbhjgfcz/auth/users"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gold hover:underline"
          >
            Supabase → Authentication → Users → Add user
          </a>
          , then run{" "}
          <code className="rounded bg-bg-4 px-1 font-mono">
            scripts/assign-role.sql
          </code>{" "}
          to assign their role.
        </div>
      </Card>

      <ScopeDialog
        user={scopeTarget}
        org={org}
        onClose={() => setScopeTarget(null)}
        onSave={(deaneryId, parishId) =>
          scopeTarget && assignScopeMut.mutate({ userId: scopeTarget.id, deaneryId, parishId })
        }
        isPending={assignScopeMut.isPending}
      />
    </div>
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
  onSave: (deaneryId: string | null, parishId: string | null) => void;
  isPending: boolean;
}) {
  const [deaneryId, setDeaneryId] = useState<string>("");
  const [parishId,  setParishId]  = useState<string>("");

  useEffect(() => {
    if (user) {
      setDeaneryId(user.deanery_id ?? "");
      setParishId(user.parish_id ?? "");
    }
  }, [user]);

  const parishOptions = (org?.parishes ?? [])
    .filter((p) => !deaneryId || p.deanery_id === deaneryId);

  return (
    <Dialog open={!!user} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md border-border bg-white text-foreground">
        <DialogHeader>
          <DialogTitle className="text-display text-xl font-black text-gold">
            Assign Data Scope
          </DialogTitle>
          <DialogDescription className="text-[12px] text-text-3">
            <strong>{user?.full_name ?? user?.email}</strong> — Restricts all queries to the selected
            deanery or parish. Leave blank for diocese-wide access.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <label className="block space-y-1 text-[10px] font-bold uppercase tracking-wide text-text-3">
            <span>Deanery (optional)</span>
            <select
              value={deaneryId}
              onChange={(e) => { setDeaneryId(e.target.value); setParishId(""); }}
              className="w-full rounded-lg border border-border bg-bg-2 px-3 py-2 text-[11px] text-foreground outline-none transition focus:border-gold-3"
            >
              <option value="">— Diocese-wide (no restriction) —</option>
              {(org?.deaneries ?? []).map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </label>

          <label className="block space-y-1 text-[10px] font-bold uppercase tracking-wide text-text-3">
            <span>Parish (optional — narrows to parish level)</span>
            <select
              value={parishId}
              disabled={!deaneryId}
              onChange={(e) => setParishId(e.target.value)}
              className="w-full rounded-lg border border-border bg-bg-2 px-3 py-2 text-[11px] text-foreground outline-none transition focus:border-gold-3 disabled:opacity-40"
            >
              <option value="">— All parishes in deanery —</option>
              {parishOptions.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>

          {(deaneryId || parishId) && (
            <div className="rounded-lg border border-info/30 bg-info-soft px-3 py-2 text-[11px] text-text-1">
              This user will <strong>only see data</strong> from{" "}
              {parishId
                ? (org?.parishes ?? []).find((p) => p.id === parishId)?.name ?? "selected parish"
                : (org?.deaneries ?? []).find((d) => d.id === deaneryId)?.name ?? "selected deanery"}{" "}
              when they log in.
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
          {(deaneryId || parishId) && (
            <button
              type="button"
              onClick={() => onSave(null, null)}
              disabled={isPending}
              className="rounded-lg border border-border bg-bg-3 px-3 py-2 text-[11px] font-bold text-text-2 hover:border-danger hover:text-danger disabled:opacity-50"
            >
              Clear scope
            </button>
          )}
          <button
            type="button"
            onClick={() => onSave(deaneryId || null, parishId || null)}
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
/* Roles Tab                                                           */
/* ------------------------------------------------------------------ */
function RolesTab() {
  const [selectedRole, setSelectedRole] = useState("office");
  const qc = useQueryClient();

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
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["role-permissions", selectedRole] }),
  });

  const perm = (moduleKey: string) =>
    permissions.find((p) => p.module === moduleKey);

  const roleInfo = ROLES.find((r) => r.value === selectedRole);

  return (
    <div>
      <p className="mb-5 text-[12px] text-text-3">Define what each role can access across every module</p>

      {/* Role selector */}
      <div className="mb-4 flex flex-wrap gap-2">
        {ROLES.map((r) => (
          <button
            key={r.value}
            onClick={() => setSelectedRole(r.value)}
            className={`rounded-xl border-2 px-4 py-2 text-[11px] font-bold transition-all ${
              selectedRole === r.value
                ? "border-danger bg-danger text-white shadow-md"
                : "border-gold/30 bg-white text-gold-3 hover:border-gold/60"
            }`}
          >
            {r.label}
          </button>
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
              <Pill tone={roleTone(selectedRole)}>{selectedRole}</Pill>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Permission matrix */}
      <Card>
        <CardHead
          title="Permission Matrix"
          subtitle={`Toggle what the '${selectedRole}' role can do in each module`}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-border bg-bg-2">
                <th className="w-44 px-3.5 py-2.5 text-left font-bold text-gold">
                  Module
                </th>
                {ACTIONS.map((a) => (
                  <th
                    key={a.key}
                    className="w-20 px-3.5 py-2.5 text-center font-bold text-gold"
                  >
                    {a.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3.5 py-8 text-center text-text-3"
                  >
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
                      <td className="px-3.5 py-2 font-medium text-foreground">
                        {mod.label}
                      </td>
                      {ACTIONS.map((action) => {
                        const checked = p
                          ? Boolean(p[action.key as keyof RolePermission])
                          : false;
                        return (
                          <td
                            key={action.key}
                            className="px-3.5 py-2 text-center"
                          >
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
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Activity Tab                                                        */
/* ------------------------------------------------------------------ */
function ActivityTab() {
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users-activity"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*, user_roles(role)")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as UserProfile[];
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
                <th className="px-3.5 py-2.5 text-left font-bold text-gold">
                  Account Created
                </th>
                <th className="px-3.5 py-2.5 text-left font-bold text-gold">
                  Last Updated
                </th>
                <th className="px-3.5 py-2.5 text-left font-bold text-gold">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3.5 py-10 text-center text-text-3"
                  >
                    Loading…
                  </td>
                </tr>
              )}
              {!isLoading && users.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3.5 py-10 text-center text-text-3"
                  >
                    No users found
                  </td>
                </tr>
              )}
              {pagination.pageRows.map((user) => {
                const role = user.user_roles?.[0]?.role ?? null;
                return (
                  <tr
                    key={user.id}
                    className="border-b border-border last:border-0 hover:bg-bg-1"
                  >
                    <td className="px-3.5 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gold-3 bg-bg-4 text-[8px] font-bold text-gold">
                          {initials(user.full_name)}
                        </div>
                        <div>
                          <div className="font-medium text-foreground">
                            {user.full_name ?? "—"}
                          </div>
                          {user.email && (
                            <div className="text-[9px] text-text-3">
                              {user.email}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3.5 py-2.5">
                      {role ? (
                        <Pill tone={roleTone(role)}>{role}</Pill>
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
