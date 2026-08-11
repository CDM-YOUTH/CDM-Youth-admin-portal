/**
 * Bulk-import youth records from a structured XLSX file.
 *
 * Handles in one pass per row:
 *   - Youth record creation (skip if full_name+phone already exists)
 *   - CUSA entry auto-creation for Tertiary students with institution
 *   - Leadership role appointment across up to 4 org levels
 *   - Auto-creation of unknown parishes (under matched deanery)
 *   - Auto-creation of unknown outstations (under matched parish)
 *   - Auto-creation of unknown role type names
 */
import ExcelJS from "exceljs";
import { supabase } from "@/integrations/supabase/client";
import { fetchOrg, type OrgTree, type ParishRow, type OutstationRow } from "@/lib/db/org";
import { listRoleTypes, type RoleTypeRow } from "./leaders";

// ── Types ───────────────────────────────────────────────────────────────────

export type ImportRowData = {
  fullName: string;
  gender: string;
  age: string;        // display value — range string or plain number
  phone: string;
  altPhone: string;
  email: string;
  deanery: string;
  parish: string;
  outstation: string;
  category: string;
  institution: string;
  yearOfStudy: string;
  course: string;
  notes: string;
  Diocese: string;
  Deanery: string;
  Parish: string;
  Outstation: string;
};

export type ImportRowError = { row: number; reason: string; data?: ImportRowData; conflictHolder?: string };

export type ImportResult = {
  inserted: number;
  updated: number;
  skipped: number;
  createdParishes: string[];
  createdOutstations: string[];
  createdRoleTypes: string[];
  errors: ImportRowError[];
};

type ParsedRow = {
  rowNum: number;
  fullName: string;
  gender: string;
  age: number;
  ageRange: string | null;
  phone: string;
  altPhone: string;
  email: string;
  deanery: string;
  parish: string;
  outstation: string;
  category: string;
  institution: string;
  yearOfStudy: string;
  course: string;
  notes: string;
  // Leadership: column header = level label, value = role name
  Diocese: string;
  Deanery: string;
  Parish: string;
  Outstation: string;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parse age from a cell that may be a plain number ("22") or a range ("18-25",
 * "18–25", "18 - 25").
 *
 * Returns:
 *   numeric — the lower bound (used for the DB `age int` column)
 *   range   — the original trimmed string if it was a range, null if it was plain
 */
function ageToRange(n: number): string {
  if (n < 18)  return "Below 18";
  if (n <= 24) return "18-24";
  return "25-30";
}

function parseAge(val: string): { numeric: number; range: string | null } {
  const s = val.trim();
  if (!s) return { numeric: 0, range: null };
  const isRange = /[-–—]/.test(s);
  const match = s.match(/\d+/);
  const numeric = match ? parseInt(match[0], 10) : 0;
  const range = isRange ? s : (numeric > 0 ? ageToRange(numeric) : null);
  return { numeric, range };
}

// ── XLSX parsing ─────────────────────────────────────────────────────────────

async function parseXlsx(file: File): Promise<ParsedRow[]> {
  const buffer = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.getWorksheet(1);
  if (!ws) throw new Error("No worksheet found in the Excel file");

  const headers: string[] = [];
  ws.getRow(1).eachCell({ includeEmpty: false }, (cell, colNum) => {
    headers[colNum - 1] = String(cell.value ?? "").trim();
  });

  const rows: ParsedRow[] = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
    if (rowNum === 1) return;

    const get = (header: string): string => {
      const idx = headers.indexOf(header);
      if (idx < 0) return "";
      const v = row.getCell(idx + 1).value;
      if (v === null || v === undefined) return "";
      let raw: string;
      if (typeof v === "object" && "result" in (v as object)) {
        raw = String((v as { result: unknown }).result ?? "");
      } else if (typeof v === "object" && "richText" in (v as object)) {
        // Excel rich-text cell — extract plain text from each run
        raw = ((v as { richText: { text: string }[] }).richText ?? []).map((r) => r.text).join("");
      } else {
        raw = String(v);
      }
      // Normalize Unicode bold/italic math chars (from Word/Excel styling) to ASCII
      return raw.trim().normalize("NFKC");
    };

    // Accept both "full_name" and "full name" variants in the header
    const fullName =
      get("full_name") || get("Full Name") || get("FULL NAME") || get("name") || get("Name");

    rows.push({
      rowNum,
      fullName,
      gender:      get("gender")        || get("GENDER"),
      ...(() => { const a = parseAge(get("age") || get("AGE")); return { age: a.numeric, ageRange: a.range }; })(),
      phone:       get("phone")         || get("PHONE"),
      altPhone:    get("alt_phone")     || get("Alt Phone")     || get("ALT PHONE"),
      email:       get("email")         || get("EMAIL"),
      // Org columns: lowercase or UPPERCASE only — never Title Case (reserved for leadership)
      deanery:     get("deanery")       || get("DEANERY"),
      parish:      get("parish")        || get("PARISH"),
      outstation:  get("outstation")    || get("OUTSTATION"),
      category:    get("category")      || get("CATEGORY"),
      institution: get("institution")   || get("INSTITUTION"),
      yearOfStudy: get("year_of_study") || get("Year of Study") || get("YEAR OF STUDY"),
      course:      get("course")        || get("COURSE"),
      notes:       get("notes")         || get("NOTES"),
      // Leadership columns: Title Case header — distinct from lowercase org column names
      Diocese:     get("Diocese"),
      Deanery:     get("Deanery"),
      Parish:      get("Parish"),
      Outstation:  get("Outstation"),
    });
  });

  return rows.filter((r) => r.fullName || r.phone);
}

// ── Org lookups (case-insensitive, mutated as new entries are created) ────────

type OrgMaps = {
  deaneryByName: Map<string, string>;             // name_lower → id
  parishByKey: Map<string, string>;               // deanery_id:name_lower → id
  outstationByKey: Map<string, string>;           // parish_id:name_lower → id
  parishRows: ParishRow[];
  outstationRows: OutstationRow[];
};

function buildOrgMaps(org: OrgTree): OrgMaps {
  const deaneryByName = new Map<string, string>();
  const parishByKey = new Map<string, string>();
  const outstationByKey = new Map<string, string>();

  for (const d of org.deaneries) {
    deaneryByName.set(d.name.trim().toLowerCase(), d.id);
  }
  for (const p of org.parishes) {
    parishByKey.set(`${p.deanery_id}:${p.name.trim().toLowerCase()}`, p.id);
  }
  for (const o of org.outstations) {
    outstationByKey.set(`${o.parish_id}:${o.name.trim().toLowerCase()}`, o.id);
  }

  return {
    deaneryByName,
    parishByKey,
    outstationByKey,
    parishRows: [...org.parishes],
    outstationRows: [...org.outstations],
  };
}

async function ensureParish(
  maps: OrgMaps,
  deaneryId: string,
  name: string,
  created: string[],
): Promise<string> {
  const key = `${deaneryId}:${name.trim().toLowerCase()}`;
  if (maps.parishByKey.has(key)) return maps.parishByKey.get(key)!;

  const { data, error } = await supabase
    .from("parishes")
    .insert({ deanery_id: deaneryId, name: name.trim() })
    .select("id, deanery_id, name")
    .single();
  if (error) throw new Error(`Could not create parish "${name}": ${error.message}`);

  const row = data as ParishRow;
  maps.parishByKey.set(key, row.id);
  maps.parishRows.push(row);
  created.push(name.trim());
  return row.id;
}

async function ensureOutstation(
  maps: OrgMaps,
  parishId: string,
  name: string,
  created: string[],
): Promise<string> {
  const key = `${parishId}:${name.trim().toLowerCase()}`;
  if (maps.outstationByKey.has(key)) return maps.outstationByKey.get(key)!;

  const { data, error } = await supabase
    .from("outstations")
    .insert({ parish_id: parishId, name: name.trim() })
    .select("id, parish_id, name")
    .single();
  if (error) throw new Error(`Could not create outstation "${name}": ${error.message}`);

  const row = data as OutstationRow;
  maps.outstationByKey.set(key, row.id);
  maps.outstationRows.push(row);
  created.push(name.trim());
  return row.id;
}

// ── Role type lookups ─────────────────────────────────────────────────────────

async function buildRoleMap(
  roleTypes: RoleTypeRow[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const rt of roleTypes) {
    map.set(rt.name.trim().toLowerCase(), rt.id);
  }
  return map;
}

async function ensureRoleType(
  map: Map<string, string>,
  name: string,
  created: string[],
): Promise<string> {
  const key = name.trim().toLowerCase();
  if (map.has(key)) return map.get(key)!;

  const { data, error } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("leadership_role_types" as any)
    .insert({ name: name.trim() })
    .select("id, name")
    .single();
  if (error) throw new Error(`Could not create role type "${name}": ${error.message}`);

  const row = data as unknown as { id: string; name: string };
  map.set(key, row.id);
  created.push(name.trim());
  return row.id;
}

// ── Row-data snapshot for error logging ──────────────────────────────────────

function rowData(row: ParsedRow): ImportRowData {
  return {
    fullName:    row.fullName,
    gender:      row.gender,
    age:         row.ageRange ?? String(row.age),
    phone:       row.phone,
    altPhone:    row.altPhone,
    email:       row.email,
    deanery:     row.deanery,
    parish:      row.parish,
    outstation:  row.outstation,
    category:    row.category,
    institution: row.institution,
    yearOfStudy: row.yearOfStudy,
    course:      row.course,
    notes:       row.notes,
    Diocese:     row.Diocese,
    Deanery:     row.Deanery,
    Parish:      row.Parish,
    Outstation:  row.Outstation,
  };
}

// ── Duplicate detection ───────────────────────────────────────────────────────
// Per-row DB lookup: avoids the LIMIT / ORDER BY snapshot problem.
// Primary:   name (case-insensitive) + exact deanery + parish + outstation
// Secondary: phone number (fallback when org info differs between imports)

async function findExistingYouth(
  fullName: string,
  deaneryId: string | null,
  parishId: string | null,
  outstationId: string | null,
  phone: string | null,
): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (supabase as any)
    .from("youths")
    .select("id")
    .ilike("full_name", fullName.trim())
    .eq("deanery_id", deaneryId)
    .eq("parish_id", parishId);

  if (outstationId) {
    q = q.eq("outstation_id", outstationId);
  } else {
    q = q.is("outstation_id", null);
  }

  const { data: byOrg } = await q.maybeSingle();
  if (byOrg) return (byOrg as { id: string }).id;

  // Phone fallback — only when a phone number is present
  if (phone?.trim()) {
    const { data: byPhone } = await supabase
      .from("youths")
      .select("id")
      .eq("phone", phone.trim())
      .maybeSingle();
    if (byPhone) return (byPhone as unknown as { id: string }).id;
  }

  return null;
}

// ── Leadership org FK helper ──────────────────────────────────────────────────

function leaderOrgFks(
  level: string,
  deaneryId: string | null,
  parishId: string | null,
  outstationId: string | null,
) {
  if (level === "diocese")    return { deanery_id: null, parish_id: null, outstation_id: null };
  if (level === "deanery")    return { deanery_id: deaneryId, parish_id: null, outstation_id: null };
  if (level === "parish")     return { deanery_id: null, parish_id: parishId, outstation_id: null };
  /* outstation */            return { deanery_id: null, parish_id: null, outstation_id: outstationId };
}


// ── Role conflict holder lookup ─────────────────────────────────────────────

async function findRoleHolder(
  roleId: string,
  levelValue: string,
  fks: { deanery_id: string | null; parish_id: string | null; outstation_id: string | null },
): Promise<string | undefined> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (supabase as any)
    .from("youth_leadership_roles")
    .select("youth:youths(full_name)")
    .eq("role_id", roleId)
    .eq("level", levelValue);
  if (fks.deanery_id !== null)    q = q.eq("deanery_id", fks.deanery_id);    else q = q.is("deanery_id", null);
  if (fks.parish_id !== null)     q = q.eq("parish_id", fks.parish_id);      else q = q.is("parish_id", null);
  if (fks.outstation_id !== null) q = q.eq("outstation_id", fks.outstation_id); else q = q.is("outstation_id", null);
  const { data } = await q.maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any)?.youth?.full_name ?? undefined;
}
// ── Main import function ──────────────────────────────────────────────────────

export async function importYouths(
  file: File,
  onProgress?: (current: number, total: number) => void,
): Promise<ImportResult> {
  const result: ImportResult = {
    inserted: 0,
    updated: 0,
    skipped: 0,
    createdParishes: [],
    createdOutstations: [],
    createdRoleTypes: [],
    errors: [],
  };

  // Parse file
  const parsed = await parseXlsx(file);
  if (parsed.length === 0) throw new Error("No data rows found in the Excel file");

  // Load reference data in parallel
  const [org, roleTypes] = await Promise.all([fetchOrg(), listRoleTypes()]);
  const maps = buildOrgMaps(org);
  const roleMap = await buildRoleMap(roleTypes);

  const VALID_CATEGORIES = new Set(["Primary", "Secondary", "Tertiary", "Working"]);
  const VALID_GENDERS = new Set(["Female", "Male"]);
  const LEVEL_MAP: Record<string, string> = {
    Diocese: "diocese",
    Deanery: "deanery",
    Parish: "parish",
    Outstation: "outstation",
  };

  for (let i = 0; i < parsed.length; i++) {
    const row = parsed[i];
    onProgress?.(i + 1, parsed.length);

    // ── Validate required fields ─────────────────────────────────────────────
    if (!row.fullName) {
      result.errors.push({ row: row.rowNum, reason: "Missing full name", data: rowData(row) });
      continue;
    }
    if (!row.deanery) {
      result.errors.push({ row: row.rowNum, reason: `${row.fullName}: missing deanery`, data: rowData(row) });
      continue;
    }
    if (!row.parish) {
      result.errors.push({ row: row.rowNum, reason: `${row.fullName}: missing parish`, data: rowData(row) });
      continue;
    }
    const age = row.age;
    const displayAge = row.ageRange ?? String(row.age);
    if (!age || age < 5 || age > 80) {
      result.errors.push({ row: row.rowNum, reason: `${row.fullName}: invalid age (${displayAge})`, data: rowData(row) });
      continue;
    }

    // ── Normalise optional fields ────────────────────────────────────────────
    const gender = VALID_GENDERS.has(row.gender) ? row.gender : "Female";
    const category = VALID_CATEGORIES.has(row.category) ? row.category : "Secondary";

    // ── Resolve org IDs ──────────────────────────────────────────────────────
    const deaneryId = maps.deaneryByName.get(row.deanery.trim().toLowerCase()) ?? null;
    if (!deaneryId) {
      result.errors.push({
        row: row.rowNum,
        reason: `${row.fullName}: deanery not found — "${row.deanery}"`,
        data: rowData(row),
      });
      continue;
    }

    let parishId: string | null = null;
    try {
      parishId = await ensureParish(maps, deaneryId, row.parish, result.createdParishes);
    } catch (e) {
      result.errors.push({ row: row.rowNum, reason: `${row.fullName}: ${(e as Error).message}`, data: rowData(row) });
      continue;
    }

    let outstationId: string | null = null;
    if (row.outstation) {
      try {
        outstationId = await ensureOutstation(maps, parishId, row.outstation, result.createdOutstations);
      } catch (e) {
        result.errors.push({
          row: row.rowNum,
          reason: `${row.fullName}: outstation warning — ${(e as Error).message}`,
          data: rowData(row),
        });
      }
    }

    // ── Check for existing youth (per-row DB lookup — no snapshot limit) ────────
    const existingId = await findExistingYouth(
      row.fullName, deaneryId, parishId, outstationId, row.phone || null,
    );

    let youthId: string;

    if (existingId) {
      // ── Update existing youth — fill in any new/missing details ─────────────
      const patch: Record<string, unknown> = {};
      if (row.phone)       patch.phone         = row.phone.trim();
      if (row.altPhone)    patch.alt_phone      = row.altPhone;
      if (row.email)       patch.email          = row.email;
      if (age > 0)         patch.age            = age;
      if (row.ageRange)    patch.age_range      = row.ageRange;
      if (VALID_GENDERS.has(row.gender))     patch.gender    = row.gender;
      if (VALID_CATEGORIES.has(row.category)) patch.category  = row.category;
      if (row.institution) patch.institution    = row.institution;
      if (row.yearOfStudy) patch.year_of_study  = row.yearOfStudy;
      if (row.notes)       patch.notes          = row.notes;

      if (Object.keys(patch).length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from("youths").update(patch).eq("id", existingId);
      }

      youthId = existingId;
      result.updated++;
    } else {
      // ── Insert new youth ─────────────────────────────────────────────────────
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: youth, error: yErr } = await (supabase as any)
          .from("youths")
          .insert({
            full_name:     row.fullName.trim(),
            gender:        gender as "Female" | "Male",
            age,
            age_range:     row.ageRange || null,
            phone:         row.phone.trim() || null,
            alt_phone:     row.altPhone || null,
            email:         row.email || null,
            deanery_id:    deaneryId,
            parish_id:     parishId,
            outstation_id: outstationId,
            category:      category as "Primary" | "Secondary" | "Tertiary" | "Working",
            institution:   row.institution || null,
            year_of_study: row.yearOfStudy || null,
            notes:         row.notes || null,
          })
          .select("id, cdm_id")
          .single();

        if (yErr) {
          result.errors.push({ row: row.rowNum, reason: `${row.fullName}: ${yErr.message}`, data: rowData(row) });
          continue;
        }

        youthId = (youth as { id: string; cdm_id: string }).id;
        result.inserted++;

        // ── CUSA: auto-create for Tertiary with institution ────────────────────
        if (category === "Tertiary" && row.institution.trim()) {
          try {
            await supabase.from("cusa_members").insert({
              youth_id:      youthId,
              institution:   row.institution.trim(),
              course:        row.course || null,
              year_of_study: row.yearOfStudy || null,
            });
          } catch {
            // Non-fatal
          }
        }
      } catch (e) {
        result.errors.push({ row: row.rowNum, reason: `${row.fullName}: ${(e as Error).message}`, data: rowData(row) });
        continue;
      }
    }

    // ── Leadership roles (runs for both new and existing youths) ─────────────
    for (const [colLabel, levelValue] of Object.entries(LEVEL_MAP)) {
      const roleName = (row as unknown as Record<string, string>)[colLabel]?.trim();
      if (!roleName || roleName === "-" || roleName === "—") continue;
      if (levelValue === "outstation" && !outstationId) continue;
      if (levelValue === "deanery"    && !deaneryId)    continue;
      if (levelValue === "parish"     && !parishId)     continue;

      try {
        const roleId = await ensureRoleType(roleMap, roleName, result.createdRoleTypes);
        const fks = leaderOrgFks(levelValue, deaneryId, parishId, outstationId);

        // Skip silently if this youth already holds this exact role
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: alreadyHas } = await (supabase as any)
          .from("youth_leadership_roles")
          .select("id")
          .eq("youth_id", youthId)
          .eq("role_id", roleId)
          .eq("level", levelValue)
          .maybeSingle();
        if (alreadyHas) continue;

        const { error: rErr } = await supabase
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .from("youth_leadership_roles" as any)
          .insert({ youth_id: youthId, role_id: roleId, level: levelValue, ...fks });

        if (rErr) {
          const conflictHolder = await findRoleHolder(roleId, levelValue, fks);
          result.errors.push({
            row: row.rowNum,
            reason: `${row.fullName}: leadership conflict — ${roleName} at ${colLabel} level already assigned`,
            data: rowData(row),
            conflictHolder,
          });
        }
      } catch (e) {
        result.errors.push({
          row: row.rowNum,
          reason: `${row.fullName}: leadership error — ${(e as Error).message}`,
          data: rowData(row),
        });
      }
    }
  }

  return result;
}

// ── Template download helper ──────────────────────────────────────────────────

export type TemplateOpts = {
  deaneryNames: string[];
  parishByDeanery: Record<string, string[]>;
  outstationByParish: Record<string, string[]>;
  roleTypeNames: string[];
};

export async function buildTemplateOpts(): Promise<TemplateOpts> {
  const [org, roleTypes] = await Promise.all([fetchOrg(), listRoleTypes()]);
  const deaneryNames = org.deaneries.map((d) => d.name);
  const parishByDeanery: Record<string, string[]> = {};
  for (const [dName, parishes] of org.parishesByDeaneryName) {
    parishByDeanery[dName] = parishes.map((p) => p.name);
  }
  const outstationByParish: Record<string, string[]> = {};
  for (const [pName, outstations] of org.outstationsByParishName) {
    outstationByParish[pName] = outstations.map((o) => o.name);
  }
  return {
    deaneryNames,
    parishByDeanery,
    outstationByParish,
    roleTypeNames: roleTypes.map((r) => r.name),
  };
}
