export type LocalChurch = {
  id: string;
  name: string;
  youths: number;
  enrolled: number;
  cusaMembers: number;
  cusaActive: number;
  missionNominees: number;
  missionPairs: number;
  missionReports: number;
  categories: {
    primary: number;
    secondary: number;
    tertiary: number;
    working: number;
  };
};

export type Parish = {
  id: string;
  name: string;
  churches: LocalChurch[];
};

export type Deanery = {
  code: string;
  name: string;
  parishes: Parish[];
};

const parishLists: Array<{ code: string; name: string; parishes: string[] }> = [
  {
    code: "tuthu",
    name: "Tuthu Deanery",
    parishes: ["Tuthu", "Kanyenya-Ini", "Muthangari", "Kahatia", "Kiria-Ini", "Kiangunyi"],
  },
  {
    code: "muranga",
    name: "Murang’a Deanery",
    parishes: ["Gitui", "Gaturi", "Mugoiri", "Cathedral", "Mumbi"],
  },
  {
    code: "mwea",
    name: "Mwea Deanery",
    parishes: ["Karaba", "Kimbimbi", "Mwea", "Sagana", "Wang’uru"],
  },
  {
    code: "kianyaga",
    name: "Kianyaga Deanery",
    parishes: ["Kiamutugu", "Karumandi", "Kianyaga", "Difathas", "Piai", "Kutus"],
  },
  {
    code: "maragua",
    name: "Maragua Deanery",
    parishes: ["Sabasaba", "Ichagaki", "Ithanga", "Kitito", "Muthithi", "Maragwa", "Makuyu", "Kenol"],
  },
  {
    code: "gaichanjiru",
    name: "Gaichanjiru Deanery",
    parishes: ["Nguthuru", "Ndonga", "Makomboki", "Mununga", "Kariua", "Kangari", "Mariira", "Gaichanjiru"],
  },
  {
    code: "gatanga",
    name: "Gatanga Deanery",
    parishes: ["Mukurwe", "Ruchu", "Kaburugi", "Gacharage", "Mahuti", "Mukarara", "Gatanga", "Gatura"],
  },
  {
    code: "baricho",
    name: "Baricho Deanery",
    parishes: ["Kibingoti", "Kiang’ombe", "Kiangai", "Kangaita", "Baricho", "Gathambi", "Kagio", "Kerugoya", "Kagumo"],
  },
];

const churchPrefixes = ["St. Mary", "St. Joseph", "Holy Family", "Christ the King", "St. Peter"];
const churchSuffixes = ["Youth Centre", "Outstation", "Chapel", "Community", "Mission"];

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function churchMetrics(deaneryIndex: number, parishIndex: number, churchIndex: number, parishName: string): LocalChurch {
  const seed = (deaneryIndex + 2) * 37 + (parishIndex + 3) * 19 + (churchIndex + 1) * 11;
  const youths = 56 + (seed % 96) + churchIndex * 13;
  const enrolled = Math.round(youths * (0.62 + (seed % 27) / 100));
  const cusaMembers = 4 + (seed % 18);
  const cusaActive = Math.max(1, Math.round(cusaMembers * (0.68 + (seed % 19) / 100)));
  const missionNominees = 2 + (seed % 9);
  const missionPairs = Math.max(1, Math.round(missionNominees / 2));
  const missionReports = Math.max(1, Math.min(missionPairs, missionPairs - (seed % 3 === 0 ? 1 : 0)));
  const primary = Math.round(enrolled * (0.2 + (seed % 7) / 100));
  const secondary = Math.round(enrolled * (0.36 + (seed % 9) / 100));
  const tertiary = Math.round(enrolled * (0.18 + (seed % 6) / 100));
  const working = Math.max(0, enrolled - primary - secondary - tertiary);

  return {
    id: `${slug(parishName)}-${churchIndex + 1}`,
    name: `${churchPrefixes[(seed + churchIndex) % churchPrefixes.length]} ${parishName} ${churchSuffixes[(seed + parishIndex) % churchSuffixes.length]}`,
    youths,
    enrolled,
    cusaMembers,
    cusaActive,
    missionNominees,
    missionPairs,
    missionReports,
    categories: { primary, secondary, tertiary, working },
  };
}

export const ORGANIZATION: Deanery[] = parishLists.map((deanery, deaneryIndex) => ({
  ...deanery,
  parishes: deanery.parishes.map((parishName, parishIndex) => ({
    id: `${deanery.code}-${slug(parishName)}`,
    name: parishName,
    churches: Array.from({ length: 3 }, (_, churchIndex) =>
      churchMetrics(deaneryIndex, parishIndex, churchIndex, parishName),
    ),
  })),
}));

export type AnalyticsUnit = LocalChurch & {
  deaneryCode: string;
  deaneryName: string;
  parishId: string;
  parishName: string;
};

export const ANALYTICS_UNITS: AnalyticsUnit[] = ORGANIZATION.flatMap((deanery) =>
  deanery.parishes.flatMap((parish) =>
    parish.churches.map((church) => ({
      ...church,
      deaneryCode: deanery.code,
      deaneryName: deanery.name,
      parishId: parish.id,
      parishName: parish.name,
    })),
  ),
);

function sumUnits(units: AnalyticsUnit[]) {
  return units.reduce(
    (acc, unit) => ({
      youths: acc.youths + unit.youths,
      enrolled: acc.enrolled + unit.enrolled,
      cusaMembers: acc.cusaMembers + unit.cusaMembers,
      cusaActive: acc.cusaActive + unit.cusaActive,
      missionNominees: acc.missionNominees + unit.missionNominees,
      missionPairs: acc.missionPairs + unit.missionPairs,
      missionReports: acc.missionReports + unit.missionReports,
    }),
    { youths: 0, enrolled: 0, cusaMembers: 0, cusaActive: 0, missionNominees: 0, missionPairs: 0, missionReports: 0 },
  );
}

export const DEANERIES = ORGANIZATION.map((deanery) => {
  const totals = sumUnits(ANALYTICS_UNITS.filter((unit) => unit.deaneryCode === deanery.code));
  return { code: deanery.code, name: deanery.name, parishes: deanery.parishes.length, youths: totals.youths };
});

const totals = sumUnits(ANALYTICS_UNITS);

export const KPIS_GENERAL = [
  { label: "Total Youths", value: totals.youths.toLocaleString(), trend: "+8.2%", tone: "up" as const, sub: "mock baseline" },
  { label: "Active Parishes", value: String(ORGANIZATION.reduce((sum, d) => sum + d.parishes.length, 0)), trend: "+3 new", tone: "up" as const, sub: "from deanery list" },
  { label: "Open Welfare Cases", value: "5", trend: "2 urgent", tone: "warn" as const, sub: "needs attention" },
  { label: "Upcoming Events", value: "12", trend: "next 30d", tone: "info" as const, sub: "diocese-wide" },
  { label: "Formation Items", value: "84", trend: "+6", tone: "up" as const, sub: "this month" },
];

export const KPIS_ENROLLMENT = [
  { label: "Enrolled 2026", value: totals.enrolled.toLocaleString(), trend: `${Math.round((totals.enrolled / totals.youths) * 100)}% of target`, tone: "up" as const, sub: `of ${totals.youths.toLocaleString()}` },
  { label: "Pending Payment", value: "412", trend: "KES 206,000", tone: "warn" as const, sub: "outstanding" },
  { label: "Self-Registered", value: Math.round(totals.enrolled * 0.39).toLocaleString(), trend: "39% of total", tone: "info" as const, sub: "via Youth Portal" },
  { label: "Awaiting Approval", value: "23", trend: "parish review", tone: "warn" as const, sub: "queue" },
  { label: "Completion Rate", value: `${Math.round((totals.enrolled / totals.youths) * 100)}%`, trend: "+2.1%", tone: "up" as const, sub: "vs. 2025" },
];

export const KPIS_CUSA = [
  { label: "CUSA Members", value: totals.cusaMembers.toLocaleString(), trend: "+18", tone: "up" as const, sub: "this semester" },
  { label: "Universities", value: "14", trend: "+2 new", tone: "up" as const, sub: "represented" },
  { label: "Active Chapters", value: String(DEANERIES.length + 1), trend: "all reporting", tone: "up" as const, sub: "monthly" },
  { label: "Upcoming Retreats", value: "3", trend: "next 60d", tone: "info" as const, sub: "registration open" },
];

export const ENROLLMENT_BY_DEANERY = DEANERIES.map((deanery) => {
  const row = sumUnits(ANALYTICS_UNITS.filter((unit) => unit.deaneryCode === deanery.code));
  return { name: deanery.name, enrolled: row.enrolled, target: row.youths };
});

export const CUSA_BY_DEANERY = DEANERIES.map((deanery) => {
  const row = sumUnits(ANALYTICS_UNITS.filter((unit) => unit.deaneryCode === deanery.code));
  return { name: deanery.name, members: row.cusaMembers, chapters: deanery.parishes, active: row.cusaActive };
});

export const MISSION_BY_DEANERY = DEANERIES.map((deanery) => {
  const row = sumUnits(ANALYTICS_UNITS.filter((unit) => unit.deaneryCode === deanery.code));
  return { name: deanery.name, nominees: row.missionNominees, pairs: row.missionPairs, reports: row.missionReports };
});

const categoryTotals = ANALYTICS_UNITS.reduce(
  (acc, unit) => ({
    primary: acc.primary + unit.categories.primary,
    secondary: acc.secondary + unit.categories.secondary,
    tertiary: acc.tertiary + unit.categories.tertiary,
    working: acc.working + unit.categories.working,
  }),
  { primary: 0, secondary: 0, tertiary: 0, working: 0 },
);

export const CATEGORY_SPLIT = [
  { label: "Primary", value: categoryTotals.primary, color: "var(--color-info)" },
  { label: "Secondary", value: categoryTotals.secondary, color: "var(--color-success)" },
  { label: "Tertiary / CUSA", value: categoryTotals.tertiary, color: "var(--color-violet)" },
  { label: "Working Youth", value: categoryTotals.working, color: "var(--color-gold)" },
];

export const TOP_PARISHES = ORGANIZATION.flatMap((deanery) =>
  deanery.parishes.map((parish) => ({
    name: parish.name,
    enrolled: parish.churches.reduce((sum, church) => sum + church.enrolled, 0),
  })),
)
  .sort((a, b) => b.enrolled - a.enrolled)
  .slice(0, 5);

export const ACTIVITY_FEED = [
  { kind: "enroll", title: "Enrolled", who: "Grace Wanjiku", where: "Cathedral · Secondary", time: "2m" },
  { kind: "event", title: "Event scheduled", who: "Diocesan Youth Day", where: "Palm Sunday · 29 Mar", time: "1h" },
  { kind: "mission", title: "Mission Week", who: `${totals.missionNominees} nominees`, where: "8 deanery coordinators", time: "3h" },
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

export type EventStatus = "upcoming" | "done";

export type YouthEvent = {
  id: string;
  day: string;
  month: string;
  date: string;
  name: string;
  parish: string;
  venue: string;
  status: EventStatus;
  expected: number;
  registered: number;
  attended: number;
  guests: number;
  activities: string[];
  assignments: Array<{ role: string; person: string; area: string }>;
  items: Array<{ name: string; quantity: string; status: "ready" | "pending" | "used" }>;
  program: Array<{ time: string; activity: string; facilitator: string }>;
  topics: string[];
  gallery: string[];
};

export const EVENTS: YouthEvent[] = [
  {
    id: "diocesan-youth-day-2026",
    day: "29",
    month: "Mar",
    date: "29 Mar 2026",
    name: "Diocesan Youth Day",
    parish: "All Parishes",
    venue: "Murang’a Cathedral Grounds",
    status: "upcoming",
    expected: 1580,
    registered: 1240,
    attended: 0,
    guests: 0,
    activities: ["Opening Mass", "Deanery procession", "Talent showcase", "Youth pledge"],
    assignments: [
      { role: "Liturgy", person: "Cathedral Youth Choir", area: "Main altar" },
      { role: "Registration", person: "Deanery secretaries", area: "Entry gates" },
      { role: "Security", person: "St. Peter Team", area: "Parking" },
    ],
    items: [
      { name: "Tents", quantity: "18", status: "ready" },
      { name: "Sound system", quantity: "1 full set", status: "ready" },
      { name: "Lunch packs", quantity: "1,600", status: "pending" },
    ],
    program: [
      { time: "08:00", activity: "Arrival and registration", facilitator: "Event secretariat" },
      { time: "10:00", activity: "Holy Mass", facilitator: "Bishop and clergy" },
      { time: "14:00", activity: "Deanery presentations", facilitator: "Youth council" },
    ],
    topics: ["Synodal youth leadership", "Responsible digital life", "Vocations"],
    gallery: ["Mass setup", "Deanery banners", "Youth choir"],
  },
  {
    id: "cusa-easter-retreat-2026",
    day: "06",
    month: "Apr",
    date: "06 Apr 2026",
    name: "CUSA Easter Retreat",
    parish: "Subukia Shrine",
    venue: "Subukia Shrine",
    status: "upcoming",
    expected: 220,
    registered: 184,
    attended: 0,
    guests: 0,
    activities: ["Praise session", "Confessions", "Campus chapter reports", "Commissioning"],
    assignments: [
      { role: "Transport", person: "CUSA coordinators", area: "Campus routes" },
      { role: "Talk facilitation", person: "Fr. Peter", area: "Main hall" },
    ],
    items: [
      { name: "Retreat booklets", quantity: "230", status: "ready" },
      { name: "Water", quantity: "25 crates", status: "pending" },
    ],
    program: [
      { time: "09:00", activity: "Praise and worship", facilitator: "KU Chapter" },
      { time: "11:00", activity: "Easter faith talk", facilitator: "Fr. Peter" },
      { time: "15:00", activity: "Chapter commitments", facilitator: "CUSA chair" },
    ],
    topics: ["Faith after campus", "Catholic witness", "Chapter accountability"],
    gallery: ["Shrine arrival", "Group photo", "Prayer walk"],
  },
  {
    id: "confirmation-class-2026",
    day: "13",
    month: "Apr",
    date: "13 Apr 2026",
    name: "Confirmation Class",
    parish: "Cathedral",
    venue: "Cathedral Hall",
    status: "upcoming",
    expected: 110,
    registered: 86,
    attended: 0,
    guests: 0,
    activities: ["Catechesis", "Sponsor briefing", "Confession preparation"],
    assignments: [{ role: "Catechesis", person: "Sr. Mary", area: "Hall A" }],
    items: [{ name: "Catechism sheets", quantity: "120", status: "ready" }],
    program: [{ time: "09:30", activity: "Class session", facilitator: "Sr. Mary" }],
    topics: ["Sacraments", "Christian maturity"],
    gallery: ["Class setup", "Sponsor desk"],
  },
  {
    id: "youth-leaders-forum-2026",
    day: "27",
    month: "Apr",
    date: "27 Apr 2026",
    name: "Youth Leaders Forum",
    parish: "Bishop's House",
    venue: "Bishop's House",
    status: "upcoming",
    expected: 80,
    registered: 56,
    attended: 0,
    guests: 0,
    activities: ["Strategy review", "Deanery reporting", "Annual calendar planning"],
    assignments: [{ role: "Minutes", person: "Diocese secretary", area: "Boardroom" }],
    items: [{ name: "Planning templates", quantity: "80", status: "ready" }],
    program: [{ time: "10:00", activity: "Planning workshop", facilitator: "Youth chaplain" }],
    topics: ["Leadership", "Reporting", "Safeguarding"],
    gallery: ["Council table", "Workshop notes"],
  },
  {
    id: "lent-service-week-2026",
    day: "08",
    month: "Mar",
    date: "08 Mar 2026",
    name: "Lent Service Week",
    parish: "Kagio",
    venue: "Kagio Parish",
    status: "done",
    expected: 420,
    registered: 386,
    attended: 354,
    guests: 27,
    activities: ["Home visits", "Tree planting", "Evening recollection", "Youth confession"],
    assignments: [
      { role: "Home visit teams", person: "Parish leaders", area: "Small Christian communities" },
      { role: "Environment", person: "Mission Week nominees", area: "Parish compound" },
    ],
    items: [
      { name: "Seedlings", quantity: "500", status: "used" },
      { name: "Reflective jackets", quantity: "40", status: "used" },
      { name: "First aid kit", quantity: "3", status: "used" },
    ],
    program: [
      { time: "07:30", activity: "Commissioning prayer", facilitator: "Parish priest" },
      { time: "09:00", activity: "Service teams deployed", facilitator: "Team captains" },
      { time: "16:00", activity: "Daily report sharing", facilitator: "Youth chair" },
    ],
    topics: ["Mercy in action", "Care for creation", "Lenten conversion"],
    gallery: ["Tree planting", "Team briefing", "Closing prayer"],
  },
  {
    id: "youth-choir-festival-2026",
    day: "22",
    month: "Feb",
    date: "22 Feb 2026",
    name: "Youth Choir Festival",
    parish: "Kianyaga",
    venue: "Kianyaga Parish Grounds",
    status: "done",
    expected: 760,
    registered: 702,
    attended: 681,
    guests: 44,
    activities: ["Choir presentations", "Psalm workshop", "Awards", "Mass animation"],
    assignments: [
      { role: "Adjudication", person: "Music committee", area: "Main tent" },
      { role: "Hospitality", person: "Kianyaga youth", area: "Refreshment desk" },
    ],
    items: [
      { name: "Trophies", quantity: "12", status: "used" },
      { name: "Microphones", quantity: "8", status: "used" },
    ],
    program: [
      { time: "08:30", activity: "Choir check-in", facilitator: "Registration desk" },
      { time: "10:00", activity: "Festival performances", facilitator: "Music committee" },
      { time: "15:30", activity: "Awards", facilitator: "Youth chaplain" },
    ],
    topics: ["Liturgical music", "Psalm leadership", "Youth creativity"],
    gallery: ["Winning choir", "Stage setup", "Award moment"],
  },
];

export const UPCOMING_EVENTS = EVENTS.filter((event) => event.status === "upcoming");
export const DONE_EVENTS = EVENTS.filter((event) => event.status === "done");

export const WELFARE_CASES = [
  { id: "WF-2026-014", category: "Mental Health", urgency: "high", parish: "Kagio", opened: "5h ago", assigned: "Fr. James" },
  { id: "WF-2026-013", category: "Early Pregnancy", urgency: "high", parish: "Anonymous", opened: "1d ago", assigned: "Sr. Mary" },
  { id: "WF-2026-012", category: "Substance Abuse", urgency: "medium", parish: "Maragwā", opened: "2d ago", assigned: "Fr. Paul" },
  { id: "WF-2026-011", category: "School Fees", urgency: "low", parish: "Kangari", opened: "4d ago", assigned: "Office" },
  { id: "WF-2026-010", category: "Family Crisis", urgency: "medium", parish: "Kiria-Ini", opened: "6d ago", assigned: "Fr. James" },
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
