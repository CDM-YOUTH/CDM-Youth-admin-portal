import type { AnalyticsUnit } from "@/lib/mock-data";

export const CUSA_INSTITUTIONS = [
  "University of Nairobi",
  "Kenyatta University",
  "JKUAT",
  "Murang'a University",
  "Strathmore University",
  "Multimedia University",
  "Karatina University",
  "Dedan Kimathi University",
  "Catholic University",
];

const firstNames = ["Grace", "Peter", "Mary", "John", "Faith", "Brian", "Mercy", "Samuel", "Joy", "David", "Linda", "James", "Esther", "Anne"];
const lastNames = ["Wanjiku", "Kamau", "Njeri", "Mwangi", "Wairimu", "Otieno", "Akinyi", "Kariuki", "Wambui", "Njoroge", "Muthoni", "Maina"];

function unitSeed(unit: AnalyticsUnit) {
  return [...unit.id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

export function institutionFor(unit: AnalyticsUnit, index: number) {
  return CUSA_INSTITUTIONS[(unitSeed(unit) + index * 3) % CUSA_INSTITUTIONS.length];
}

export function cusaMembersFor(unit: AnalyticsUnit, institution = "") {
  if (!institution) return unit.cusaMembers;
  let total = 0;
  for (let index = 0; index < unit.cusaMembers; index += 1) {
    if (institutionFor(unit, index) === institution) total += 1;
  }
  return total;
}

export function cusaInstitutionRows(units: AnalyticsUnit[]) {
  return CUSA_INSTITUTIONS.map((institution) => ({
    label: institution,
    value: units.reduce((sum, unit) => sum + cusaMembersFor(unit, institution), 0),
  }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value);
}

export function cusaGenderRows(units: AnalyticsUnit[], institution = "") {
  const total = units.reduce((sum, unit) => sum + cusaMembersFor(unit, institution), 0);
  const female = units.reduce((sum, unit) => sum + Math.round(cusaMembersFor(unit, institution) * (0.47 + (unitSeed(unit) % 9) / 100)), 0);
  return [
    { label: "Female", value: Math.min(female, total), color: "var(--color-pink)" },
    { label: "Male", value: Math.max(0, total - female), color: "var(--color-info)" },
  ];
}

export type CusaMember = {
  id: string;
  name: string;
  gender: "Female" | "Male";
  institution: string;
  deaneryName: string;
  parishName: string;
  churchName: string;
  course: string;
  year: string;
  status: "active" | "reporting";
};

export function buildCusaMembers(units: AnalyticsUnit[], institution = ""): CusaMember[] {
  return units.flatMap((unit) =>
    Array.from({ length: unit.cusaMembers }, (_, index) => {
      const selectedInstitution = institutionFor(unit, index);
      const gender = (unitSeed(unit) + index) % 2 === 0 ? "Female" : "Male";
      return {
        id: `${unit.id}-cusa-${index}`,
        name: `${firstNames[(unitSeed(unit) + index) % firstNames.length]} ${lastNames[(unitSeed(unit) + index * 2) % lastNames.length]}`,
        gender,
        institution: selectedInstitution,
        deaneryName: unit.deaneryName,
        parishName: unit.parishName,
        churchName: unit.name,
        course: ["Education", "Commerce", "Nursing", "Engineering", "Arts", "ICT"][(unitSeed(unit) + index) % 6],
        year: `Year ${1 + ((unitSeed(unit) + index) % 4)}`,
        status: index < unit.cusaActive ? "active" : "reporting",
      } satisfies CusaMember;
    }).filter((member) => !institution || member.institution === institution),
  );
}