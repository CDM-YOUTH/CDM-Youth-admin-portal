import { ANALYTICS_UNITS, type AnalyticsUnit } from "@/lib/mock-data";
import { CUSA_INSTITUTIONS } from "@/lib/cusa-data";

const firstNames = [
  "Grace", "Peter", "Mary", "John", "Faith", "Brian", "Mercy", "Samuel",
  "Joy", "David", "Linda", "James", "Esther", "Anne", "Kevin", "Lucy",
  "Daniel", "Ruth", "Paul", "Naomi", "Stephen", "Rose", "Joseph", "Hannah",
];
const lastNames = [
  "Wanjiku", "Kamau", "Njeri", "Mwangi", "Wairimu", "Otieno", "Akinyi",
  "Kariuki", "Wambui", "Njoroge", "Muthoni", "Maina", "Kimani", "Wangari",
  "Macharia", "Gathoni", "Kuria", "Nduta", "Karanja", "Wanjiru",
];

const CATEGORIES = ["Primary", "Secondary", "Tertiary", "Working"] as const;
export type YouthCategory = (typeof CATEGORIES)[number];

export type Gender = "Female" | "Male";

export type YouthRecord = {
  id: string;
  cdmId: string;
  name: string;
  gender: Gender;
  age: number;
  deaneryCode: string;
  deaneryName: string;
  parishId: string;
  parishName: string;
  churchId: string;
  churchName: string;
  category: YouthCategory;
  institution: string | null;
  status: "active" | "inactive";
  enrolled: boolean;
};

function unitSeed(unit: AnalyticsUnit) {
  return [...unit.id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function categoryFor(unit: AnalyticsUnit, index: number): YouthCategory {
  const totals = unit.categories;
  const order: YouthCategory[] = [];
  for (let i = 0; i < totals.primary; i += 1) order.push("Primary");
  for (let i = 0; i < totals.secondary; i += 1) order.push("Secondary");
  for (let i = 0; i < totals.tertiary; i += 1) order.push("Tertiary");
  for (let i = 0; i < totals.working; i += 1) order.push("Working");
  return order[index % Math.max(1, order.length)] ?? "Secondary";
}

function institutionFor(unit: AnalyticsUnit, index: number, category: YouthCategory) {
  if (category !== "Tertiary") return null;
  return CUSA_INSTITUTIONS[(unitSeed(unit) + index * 3) % CUSA_INSTITUTIONS.length];
}

function ageFor(category: YouthCategory, seed: number): number {
  const base = category === "Primary" ? 10 : category === "Secondary" ? 14 : category === "Tertiary" ? 19 : 24;
  return base + (seed % 6);
}

function pad(value: number, width: number) {
  return String(value).padStart(width, "0");
}

export const YOUTH_REGISTRY: YouthRecord[] = (() => {
  const records: YouthRecord[] = [];
  let serial = 1;
  for (const unit of ANALYTICS_UNITS) {
    const seed = unitSeed(unit);
    // sample 8 representative youths per outstation to keep memory bounded
    const sampleCount = Math.min(8, unit.youths);
    for (let index = 0; index < sampleCount; index += 1) {
      const category = categoryFor(unit, index + (seed % 4));
      const gender: Gender = (seed + index) % 2 === 0 ? "Female" : "Male";
      const first = firstNames[(seed + index) % firstNames.length];
      const last = lastNames[(seed + index * 2) % lastNames.length];
      const enrolled = (seed + index) % 5 !== 0;
      const status: "active" | "inactive" = (seed + index) % 11 === 0 ? "inactive" : "active";
      const cdmId = `CDM-2026-${pad(serial, 5)}`;
      records.push({
        id: `${unit.id}-y${index}`,
        cdmId,
        name: `${first} ${last}`,
        gender,
        age: ageFor(category, seed + index),
        deaneryCode: unit.deaneryCode,
        deaneryName: unit.deaneryName,
        parishId: unit.parishId,
        parishName: unit.parishName,
        churchId: unit.id,
        churchName: unit.name,
        category,
        institution: institutionFor(unit, index, category),
        status,
        enrolled,
      });
      serial += 1;
    }
  }
  return records;
})();

export const YOUTH_CATEGORIES = CATEGORIES;
export const YOUTH_GENDERS: Gender[] = ["Female", "Male"];