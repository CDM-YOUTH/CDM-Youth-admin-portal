// Mock data for CDM Youth Management System — Phase 1 (no backend yet).

export const DEANERIES = [
  { code: "mc", name: "Muranga Central", parishes: 9, youths: 1820 },
  { code: "mw", name: "Mwea Deanery", parishes: 7, youths: 1340 },
  { code: "ka", name: "Kangema Deanery", parishes: 6, youths: 1105 },
  { code: "ki", name: "Kirinyaga West", parishes: 8, youths: 1620 },
  { code: "kg", name: "Kigumo Deanery", parishes: 7, youths: 1280 },
  { code: "kh", name: "Kahuro Deanery", parishes: 5, youths: 980 },
  { code: "ga", name: "Gatanga Deanery", parishes: 7, youths: 1410 },
  { code: "kd", name: "Kandara Deanery", parishes: 7, youths: 1395 },
];

export const KPIS_GENERAL = [
  { label: "Total Youths", value: "10,950", trend: "+8.2%", tone: "up" as const, sub: "vs. last year" },
  { label: "Active Parishes", value: "56", trend: "+3 new", tone: "up" as const, sub: "this year" },
  { label: "Open Welfare Cases", value: "5", trend: "2 urgent", tone: "warn" as const, sub: "needs attention" },
  { label: "Upcoming Events", value: "12", trend: "next 30d", tone: "info" as const, sub: "diocese-wide" },
  { label: "Formation Items", value: "84", trend: "+6", tone: "up" as const, sub: "this month" },
];

export const KPIS_ENROLLMENT = [
  { label: "Enrolled 2026", value: "8,240", trend: "75% of target", tone: "up" as const, sub: "of 11,000" },
  { label: "Pending Payment", value: "412", trend: "KES 206,000", tone: "warn" as const, sub: "outstanding" },
  { label: "Self-Registered", value: "3,180", trend: "39% of total", tone: "info" as const, sub: "via Youth Portal" },
  { label: "Awaiting Approval", value: "23", trend: "parish review", tone: "warn" as const, sub: "queue" },
  { label: "Completion Rate", value: "94%", trend: "+2.1%", tone: "up" as const, sub: "vs. 2025" },
];

export const KPIS_CUSA = [
  { label: "CUSA Members", value: "312", trend: "+18", tone: "up" as const, sub: "this semester" },
  { label: "Universities", value: "14", trend: "+2 new", tone: "up" as const, sub: "represented" },
  { label: "Active Chapters", value: "9", trend: "all reporting", tone: "up" as const, sub: "monthly" },
  { label: "Upcoming Retreats", value: "3", trend: "next 60d", tone: "info" as const, sub: "registration open" },
];

// Deterministic ratios per deanery to avoid SSR/CSR hydration mismatch.
const ENROLLMENT_RATIOS: Record<string, number> = {
  mc: 0.77, mw: 0.71, ka: 0.83, ki: 0.69, kg: 0.74, kh: 0.88, ga: 0.66, kd: 0.79,
};

export const ENROLLMENT_BY_DEANERY = DEANERIES.map((d) => ({
  name: d.name,
  enrolled: Math.round(d.youths * (ENROLLMENT_RATIOS[d.code] ?? 0.75)),
  target: d.youths,
}));

export const CATEGORY_SPLIT = [
  { label: "Primary", value: 2840, color: "var(--color-info)" },
  { label: "Secondary", value: 4210, color: "var(--color-success)" },
  { label: "Tertiary / CUSA", value: 1860, color: "var(--color-violet)" },
  { label: "Working Youth", value: 2040, color: "var(--color-gold)" },
];

export const TOP_PARISHES = [
  { name: "St. Joseph Murang'a", enrolled: 482 },
  { name: "Holy Family Maragua", enrolled: 421 },
  { name: "St. Peter Kandara", enrolled: 398 },
  { name: "Christ the King Kigumo", enrolled: 356 },
  { name: "St. Mary Kangema", enrolled: 312 },
];

export const ACTIVITY_FEED = [
  { kind: "enroll", title: "Enrolled", who: "Grace Wanjiku", where: "St. Joseph · Secondary", time: "2m" },
  { kind: "event", title: "Event scheduled", who: "Diocesan Youth Day", where: "Palm Sunday · 29 Mar", time: "1h" },
  { kind: "mission", title: "Mission Week", who: "47 nominees", where: "8 parish coordinators", time: "3h" },
  { kind: "welfare", title: "Welfare case opened", who: "Mental Health", where: "Anonymous · Assigned", time: "5h" },
  { kind: "uniform", title: "Uniform order", who: "120 sets", where: "Mwea Deanery", time: "8h" },
  { kind: "formation", title: "Content published", who: "Lent Reflection #4", where: "Diocese Library", time: "12h" },
];

export const MISSION_PHASES = [
  { phase: "1", name: "Nominations Open", status: "done", date: "01 Feb – 14 Feb" },
  { phase: "2", name: "Parish Review", status: "done", date: "15 Feb – 21 Feb" },
  { phase: "3", name: "Cross-Parish Reshuffle", status: "active", date: "22 Feb – 28 Feb" },
  { phase: "4", name: "Mission Week Execution", status: "upcoming", date: "01 Mar – 07 Mar" },
  { phase: "5", name: "Reports & Debrief", status: "upcoming", date: "08 Mar – 15 Mar" },
];

export const UPCOMING_EVENTS = [
  { day: "29", month: "Mar", name: "Diocesan Youth Day", parish: "All Parishes", rsvp: 1240 },
  { day: "06", month: "Apr", name: "CUSA Easter Retreat", parish: "Subukia Shrine", rsvp: 184 },
  { day: "13", month: "Apr", name: "Confirmation Class", parish: "St. Joseph Murang'a", rsvp: 86 },
  { day: "27", month: "Apr", name: "Youth Leaders Forum", parish: "Bishop's House", rsvp: 56 },
];

export const WELFARE_CASES = [
  { id: "WF-2026-014", category: "Mental Health", urgency: "high", parish: "St. Peter Kandara", opened: "5h ago", assigned: "Fr. James" },
  { id: "WF-2026-013", category: "Early Pregnancy", urgency: "high", parish: "Anonymous", opened: "1d ago", assigned: "Sr. Mary" },
  { id: "WF-2026-012", category: "Substance Abuse", urgency: "medium", parish: "Holy Family Maragua", opened: "2d ago", assigned: "Fr. Paul" },
  { id: "WF-2026-011", category: "School Fees", urgency: "low", parish: "St. Mary Kangema", opened: "4d ago", assigned: "Office" },
  { id: "WF-2026-010", category: "Family Crisis", urgency: "medium", parish: "Christ the King Kigumo", opened: "6d ago", assigned: "Fr. James" },
];

export const FORMATION_ITEMS = [
  { title: "Lent Reflection — Week 4", kind: "Audio", duration: "12 min", views: 482 },
  { title: "Catechism: The Eucharist", kind: "PDF", duration: "24 pages", views: 1204 },
  { title: "Youth Bible Study — John 3", kind: "Video", duration: "18 min", views: 728 },
  { title: "Vocations Discernment Guide", kind: "PDF", duration: "16 pages", views: 384 },
  { title: "Mission Week Prayer Booklet", kind: "PDF", duration: "8 pages", views: 612 },
];

export const UNIFORM_STOCK = [
  { item: "T-Shirt — Green", swatch: "var(--color-success)", inStock: 480, ordered: 200 },
  { item: "T-Shirt — Gold", swatch: "var(--color-gold)", inStock: 120, ordered: 350 },
  { item: "Cap — Embroidered", swatch: "var(--color-bg-4)", inStock: 240, ordered: 100 },
  { item: "Sash — Mission Week", swatch: "var(--color-danger)", inStock: 60, ordered: 180 },
];
