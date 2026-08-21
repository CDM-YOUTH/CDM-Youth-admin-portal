import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createYouth,
  updateYouth,
  type YouthInput,
  type YouthCategory,
  type Gender,
} from "@/lib/db/youth-records/youths";
import {
  appointLeader,
  endLeaderTerm,
  updateLeader,
  listRoleTypes,
  listActiveRolesForYouth,
  type LeadershipLevel,
} from "@/lib/db/youth-records/leaders";
import { createCusaMember } from "@/lib/db/youth-records/cusa";
import type { OrgTree } from "@/lib/db/org";
import { useAdminScope } from "@/lib/hooks/use-admin-scope";
import { useScopedOrgFields } from "@/lib/hooks/use-scoped-org";

/* ── constants ─────────────────────────────────────────────────── */

const GENDERS: Gender[] = ["Female", "Male"];
const CATEGORIES: YouthCategory[] = ["Primary", "Secondary", "Tertiary", "Working"];

type LevelDef = { value: LeadershipLevel; label: string };
const LEVELS: LevelDef[] = [
  { value: "diocese", label: "Diocese" },
  { value: "deanery", label: "Deanery" },
  { value: "parish", label: "Parish" },
  { value: "outstation", label: "Outstation" },
];

/* ── shared label class (matches RecordFormDialog) ─────────────── */
const LBL = "space-y-1 text-[10px] font-bold uppercase tracking-wide text-text-3";

/* ── types ─────────────────────────────────────────────────────── */

type LevelPositions = Partial<Record<LeadershipLevel, string>>;

export type AddYouthResult = { id: string; cdm_id: string; full_name: string };

export type YouthFormInitial = {
  fullName: string;
  gender: Gender;
  age: string;
  phone: string;
  altPhone: string;
  email: string;
  deaneryId: string;
  parishId: string;
  outstationId: string;
  category: YouthCategory;
  institution: string;
  yearOfStudy: string;
  notes: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  org: OrgTree;
  onSuccess: (youth: AddYouthResult) => void;
  title?: string;
  description?: string;
  /** When provided: edit mode — calls updateYouth instead of createYouth */
  youthId?: string;
  initial?: YouthFormInitial;
};

/* ── component ─────────────────────────────────────────────────── */

export function AddYouthDialog({
  open,
  onClose,
  org,
  onSuccess,
  title,
  description,
  youthId,
  initial,
}: Props) {
  const isEdit = !!youthId;
  const dialogTitle = title ?? (isEdit ? "Edit Youth" : "Register Youth");
  const dialogDesc = description ?? (isEdit
    ? "Update youth details. CDM No. cannot be changed."
    : "A unique CDM No. is assigned automatically on save.");

  /* ── form state ── */
  const [fullName, setFullName] = useState(initial?.fullName ?? "");
  const [gender, setGender] = useState<Gender>(initial?.gender ?? "Female");
  const [age, setAge] = useState(initial?.age ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [altPhone, setAltPhone] = useState(initial?.altPhone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [category, setCategory] = useState<YouthCategory>(initial?.category ?? "Secondary");
  const [institution, setInstitution] = useState(initial?.institution ?? "");
  const [yearOfStudy, setYearOfStudy] = useState(initial?.yearOfStudy ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  /* ── scope-aware org fields ── */
  const scope = useAdminScope();
  const {
    deaneryId,
    parishId,
    outstationId,
    setDeaneryId,
    setParishId,
    setOutstationId,
    parishOptions,
    outstationOptions,
    deaneryLocked,
    parishLocked,
    outstationLocked,
  } = useScopedOrgFields(org, scope, {
    initialDeaneryId: initial?.deaneryId,
    initialParishId: initial?.parishId,
    initialOutstationId: initial?.outstationId,
    resetKey: open,
  });

  /* ── leadership state ── */
  const [isLeader, setIsLeader] = useState(false);
  const [selectedLevels, setSelectedLevels] = useState<Set<LeadershipLevel>>(new Set());
  const [levelPositions, setLevelPositions] = useState<LevelPositions>({});
  /* tracks roles that existed in DB when dialog opened (edit mode) */
  const [existingRoles, setExistingRoles] = useState<Map<LeadershipLevel, { id: string; roleId: string }>>(new Map());

  /* role types for leadership position selects */
  const { data: roleTypes = [] } = useQuery({
    queryKey: ["role-types"],
    queryFn: listRoleTypes,
    staleTime: 5 * 60_000,
    enabled: open && isLeader,
  });

  /* fetch active roles for youth in edit mode */
  const { data: activeRoles = [] } = useQuery({
    queryKey: ["youth-active-roles", youthId],
    queryFn: () => listActiveRolesForYouth(youthId!),
    enabled: !!youthId && open,
    staleTime: 0,
  });

  /* re-seed form when initial values or open state change */
  useEffect(() => {
    if (!open) return;
    setFullName(initial?.fullName ?? "");
    setGender(initial?.gender ?? "Female");
    setAge(initial?.age ?? "");
    setPhone(initial?.phone ?? "");
    setAltPhone(initial?.altPhone ?? "");
    setEmail(initial?.email ?? "");
    setCategory(initial?.category ?? "Secondary");
    setInstitution(initial?.institution ?? "");
    setYearOfStudy(initial?.yearOfStudy ?? "");
    setNotes(initial?.notes ?? "");
    /* reset leadership — the activeRoles effect below will re-seed for edit mode */
    setIsLeader(false);
    setSelectedLevels(new Set());
    setLevelPositions({});
    setExistingRoles(new Map());
  }, [open, initial]);

  /* pre-populate leadership state from DB when editing a youth with active roles */
  useEffect(() => {
    if (!open || !youthId || activeRoles.length === 0) return;
    const map = new Map<LeadershipLevel, { id: string; roleId: string }>();
    const levels = new Set<LeadershipLevel>();
    const positions: LevelPositions = {};
    for (const role of activeRoles) {
      const level = role.level as LeadershipLevel;
      map.set(level, { id: role.id, roleId: role.role_id });
      levels.add(level);
      positions[level] = role.role_id;
    }
    setExistingRoles(map);
    setIsLeader(true);
    setSelectedLevels(levels);
    setLevelPositions(positions);
  }, [open, youthId, activeRoles]);

  /* ── mutation ── */
  const mut = useMutation({
    mutationFn: async (): Promise<AddYouthResult> => {
      const deaneryName = org.deaneries.find((d) => d.id === deaneryId)?.name ?? null;
      const parishName = org.parishes.find((p) => p.id === parishId)?.name ?? null;
      const outstationName = org.outstations.find((o) => o.id === outstationId)?.name ?? null;

      const input: YouthInput = {
        fullName: fullName.trim(),
        gender,
        age: parseInt(age, 10),
        phone: phone.trim() || null,
        altPhone: altPhone.trim() || null,
        email: email.trim() || null,
        deaneryName,
        parishName,
        outstationName,
        category,
        institution: institution.trim() || null,
        yearOfStudy: yearOfStudy.trim() || null,
        notes: notes.trim() || null,
      };

      const youth = isEdit
        ? ((await updateYouth(youthId!, input)) as AddYouthResult)
        : ((await createYouth(input)) as AddYouthResult);

      /* auto-create CUSA entry for new Tertiary youth with institution */
      if (!isEdit && category === "Tertiary" && institution.trim()) {
        await createCusaMember({
          cdmId: youth.cdm_id,
          institution: institution.trim(),
          yearOfStudy: yearOfStudy.trim() || undefined,
        });
      }

      /* ── leadership changes ── */
      if (isEdit) {
        /* end roles for levels removed or when leader toggle turned off */
        for (const [level, existing] of existingRoles) {
          if (!isLeader || !selectedLevels.has(level)) {
            await endLeaderTerm(existing.id);
          } else if (levelPositions[level] && levelPositions[level] !== existing.roleId) {
            await updateLeader(existing.id, { roleId: levelPositions[level]! });
          }
        }
        /* appoint roles for newly added levels */
        if (isLeader) {
          for (const level of selectedLevels) {
            if (!existingRoles.has(level) && levelPositions[level]) {
              await appointLeader({
                youthId: youth.id,
                roleId: levelPositions[level]!,
                level,
                deaneryId: level !== "diocese" ? (deaneryId || null) : null,
                parishId: level === "parish" || level === "outstation" ? (parishId || null) : null,
                outstationId: level === "outstation" ? (outstationId || null) : null,
              });
            }
          }
        }
      } else if (isLeader && selectedLevels.size > 0) {
        /* add mode: appoint all selected levels */
        await Promise.all(
          Array.from(selectedLevels)
            .filter((level) => !!levelPositions[level])
            .map((level) =>
              appointLeader({
                youthId: youth.id,
                roleId: levelPositions[level]!,
                level,
                deaneryId: level !== "diocese" ? (deaneryId || null) : null,
                parishId: level === "parish" || level === "outstation" ? (parishId || null) : null,
                outstationId: level === "outstation" ? (outstationId || null) : null,
              }),
            ),
        );
      }

      return youth;
    },
    onSuccess: (youth) => {
      toast.success(isEdit ? `Youth updated · ${youth.cdm_id}` : `Youth registered · ${youth.cdm_id}`);
      onSuccess(youth);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSubmit = () => {
    if (!fullName.trim()) { toast.error("Full name is required"); return; }
    const parsedAge = parseInt(age, 10);
    if (!age || isNaN(parsedAge) || parsedAge < 5 || parsedAge > 60) {
      toast.error("Enter a valid age (5–60)"); return;
    }
    if (!phone.trim()) { toast.error("Phone number is required"); return; }
    if (!deaneryId) { toast.error("Deanery is required"); return; }
    if (!parishId) { toast.error("Parish is required"); return; }
    mut.mutate();
  };

  const toggleLevel = (level: LeadershipLevel) => {
    setSelectedLevels((prev) => {
      const next = new Set(prev);
      if (next.has(level)) {
        next.delete(level);
        setLevelPositions((p) => { const n = { ...p }; delete n[level]; return n; });
      } else {
        next.add(level);
      }
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto border-border bg-white text-foreground">
        <DialogHeader>
          <DialogTitle className="text-display text-xl font-black text-gold">
            {dialogTitle}
          </DialogTitle>
          <DialogDescription className="text-[12px] text-text-3">
            {dialogDesc}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">

          {/* ── full name ── */}
          <label className={`${LBL} sm:col-span-2`}>
            <span>Full name *</span>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Grace Wanjiku Kamau"
            />
          </label>

          {/* ── gender ── */}
          <label className={LBL}>
            <span>Gender *</span>
            <Select value={gender} onValueChange={(v) => setGender(v as Gender)}>
              <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
              <SelectContent>
                {GENDERS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </label>

          {/* ── age ── */}
          <label className={LBL}>
            <span>Age *</span>
            <Input
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="18"
              min="5"
              max="60"
            />
          </label>

          {/* ── category ── */}
          <label className={LBL}>
            <span>Category *</span>
            <Select value={category} onValueChange={(v) => setCategory(v as YouthCategory)}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </label>

          {/* ── phone ── */}
          <label className={LBL}>
            <span>Phone *</span>
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+254700000000"
            />
          </label>

          {/* ── alt phone ── */}
          <label className={LBL}>
            <span>Alt. Phone</span>
            <Input
              type="tel"
              value={altPhone}
              onChange={(e) => setAltPhone(e.target.value)}
              placeholder="+254700000000"
            />
          </label>

          {/* ── email ── */}
          <label className={`${LBL} sm:col-span-2`}>
            <span>Email</span>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
            />
          </label>

          {/* ── deanery ── */}
          {!deaneryLocked && (
            <label className={LBL}>
              <span>Deanery *</span>
              <Select value={deaneryId} onValueChange={setDeaneryId}>
                <SelectTrigger><SelectValue placeholder="Select Deanery" /></SelectTrigger>
                <SelectContent>
                  {org.deaneries.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
          )}

          {/* ── parish ── */}
          {!parishLocked && (
            <label className={LBL}>
              <span>Parish *</span>
              <Select value={parishId} onValueChange={setParishId} disabled={!deaneryId}>
                <SelectTrigger><SelectValue placeholder={deaneryId ? "Select Parish" : "Choose deanery first"} /></SelectTrigger>
                <SelectContent>
                  {parishOptions.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
          )}

          {/* ── outstation ── */}
          {!outstationLocked && (
            <label className={LBL}>
              <span>Outstation</span>
              <Select value={outstationId} onValueChange={setOutstationId} disabled={!parishId}>
                <SelectTrigger><SelectValue placeholder={parishId ? "Select Outstation" : "Choose parish first"} /></SelectTrigger>
                <SelectContent>
                  {outstationOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
          )}

          {/* ── tertiary fields ── */}
          {category === "Tertiary" && (
            <>
              <label className={LBL}>
                <span>Institution</span>
                <Input
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  placeholder="e.g. Murang'a University"
                />
              </label>
              <label className={LBL}>
                <span>Year of Study</span>
                <Input
                  value={yearOfStudy}
                  onChange={(e) => setYearOfStudy(e.target.value)}
                  placeholder="Year 2"
                />
              </label>
            </>
          )}

          {/* ── notes ── */}
          <label className={`${LBL} sm:col-span-2`}>
            <span>Notes</span>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything worth recording…"
              className="resize-none"
              rows={2}
            />
          </label>

          {/* ── leadership section ── */}
          <div className="sm:col-span-2 rounded-lg border border-border bg-bg-2 p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[12px] font-bold text-text-1">Leadership role</div>
                <div className="text-[10px] text-text-3">
                  Toggle on if this youth holds a leadership position
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isLeader}
                onClick={() => setIsLeader((v) => !v)}
                className={[
                  "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                  isLeader ? "bg-danger" : "bg-border",
                ].join(" ")}
              >
                <span
                  className={[
                    "inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform",
                    isLeader ? "translate-x-4" : "translate-x-0.5",
                  ].join(" ")}
                />
              </button>
            </div>

            {isLeader && (
              <div className="mt-3 space-y-3">
                {/* level chips */}
                <div>
                  <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-text-3">
                    Select levels held
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {LEVELS.map(({ value, label }) => {
                      const active = selectedLevels.has(value);
                      const disabled =
                        (value === "deanery" && !deaneryId) ||
                        (value === "parish" && !parishId) ||
                        (value === "outstation" && !outstationId);
                      return (
                        <button
                          key={value}
                          type="button"
                          disabled={disabled}
                          onClick={() => toggleLevel(value)}
                          title={disabled ? `Select a ${value} above first` : undefined}
                          className={[
                            "rounded-full border px-3 py-0.5 text-[10px] font-bold transition",
                            "disabled:cursor-not-allowed disabled:opacity-40",
                            active
                              ? "border-danger bg-danger text-white"
                              : "border-border bg-card text-text-2 hover:border-gold-3 hover:text-text-1",
                          ].join(" ")}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* position row per selected level */}
                {Array.from(selectedLevels).map((level) => {
                  const def = LEVELS.find((l) => l.value === level)!;
                  return (
                    <div key={level} className="flex items-center gap-2">
                      <span className="w-24 shrink-0 rounded-md border border-border bg-card px-2 py-1 text-center text-[10px] font-bold uppercase tracking-wide text-text-3">
                        {def.label}
                      </span>
                      <Select
                        value={levelPositions[level] ?? ""}
                        onValueChange={(v) => setLevelPositions((prev) => ({ ...prev, [level]: v }))}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select position…" />
                        </SelectTrigger>
                        <SelectContent>
                          {roleTypes.map((rt) => (
                            <SelectItem key={rt.id} value={rt.id}>{rt.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}

                {selectedLevels.size === 0 && (
                  <p className="text-[10px] italic text-text-4">
                    Select one or more levels above, then assign a position for each.
                  </p>
                )}
              </div>
            )}
          </div>

        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border bg-bg-3 px-3 py-2 text-[11px] font-bold text-text-2"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={mut.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-[11px] font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {mut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {mut.isPending ? "Saving…" : isEdit ? "Save Changes" : "Register Youth"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
