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

const parishLists: Array<{ code: string; name: string; parishes: Array<{ name: string; outstations: string[] }> }> = [
  {
    code: "muranga",
    name: "Murang'a Deanery",
    parishes: [
      {
        name: "Mumbi",
        outstations: ["Mumbi", "Kongo-ini", "Kambirwa", "Mirira", "Matithi", "Kamuiru", "Kabuta", "Githuuri", "Gikuu", "Gitungano", "Marewa"],
      },
      {
        name: "Sacred Heart of Jesus Cathedral",
        outstations: ["St. Mary's", "Gikandu", "Mukangu", "Githunguri", "Githundi", "Kanoro", "Yakarengo", "Kiamara", "Kambara", "Nyangiti", "Christ the King", "Maragi", "Gaitega", "Ndikwe", "Kiawambeu", "Mucungucha", "Gituri", "G3", "Nyakahura", "Kiangochi", "Kiangage", "Mesco", "Muuti"],
      },
      {
        name: "Our Lady of Sorrows, Mugoiri",
        outstations: ["Mugoiri", "Gitaro", "Githagara", "Kari", "Kiratina", "Mirichu", "Kiguru", "Kahuro", "Yamugwe", "Gitiri", "Kianjogu", "Kiboi", "Mbari ya Hiti", "Kiria", "Ngaru", "Kagaa", "Munyutha", "Kiayatta", "Ndutumi"],
      },
      {
        name: "St. Teresa of the Child Jesus, Gitui",
        outstations: ["Gitui", "Gathinja", "Gatheru", "Kirogo", "Gitige", "Wanjengi"],
      },
      {
        name: "Queen of Apostles, Gaturi",
        outstations: ["Gakurwe", "Geitwa", "Ititu", "Kabui", "Kairi", "Kamune", "Kanguru", "Kigongo", "Kihingo", "Mweru", "Kiruri", "Munyu", "Mutuya", "Thuita", "Nyakihai", "Gaturi", "Kahinga", "Kihuro", "Githunguri", "Thingithu"],
      },
    ],
  },
  {
    code: "gatanga",
    name: "Gatanga Deanery",
    parishes: [
      {
        name: "St. Joseph the Worker, Gatanga",
        outstations: ["Gatanga", "Mugumo-ini", "Ithang'arari", "Kiaruguru", "Rwegetha", "Mabae", "Maria Consolata", "Mununga", "Giatutu", "Gaitegi", "Kirwara", "Mabanda"],
      },
      {
        name: "Christ the King, Gatura",
        outstations: ["Gatura", "Chomo", "Mbugiti", "Kiganjo", "Kiarutara", "Gataka-ini", "Wanyaga", "Ndaka-ini", "Giteme", "King'uri", "St. Albert", "Kanunga", "Kigoro", "Ndunyu Chege", "Wanduhi", "Kimandi", "Mwea", "Gatunguru", "Mwagu", "Karangi", "Gitoto"],
      },
      {
        name: "Our Lady Queen of Peace, Mahuti",
        outstations: ["St. John the Baptist", "Christ the King Thika Greens", "Divine Mercy", "St. Francis of Assisi Makki Estate", "St. Rose of Viterbo"],
      },
      {
        name: "St. Peter the Apostle, Kaburugi",
        outstations: ["Kaburugi", "Kiranga", "Kawendo", "Mathuri", "Muruka", "Ng'araria", "Kahaini"],
      },
      {
        name: "Our Lady of Fatima, Ruchu",
        outstations: ["Ruchu", "Kiawambutu", "Karima-mwaro", "Gathugu", "Kibereke", "Kandara", "Gatundu", "Kiiri", "Githunguri"],
      },
      {
        name: "Sacred Heart, Gacharage",
        outstations: ["Gacharage", "Kiguoya", "Ithiru", "Gathingira", "Kaguthi", "Kirigithu", "Gatii iguru", "Kibage", "Ruona", "Kahiga", "Rwathe", "Gakui", "Kagono", "Mung'aria"],
      },
      {
        name: "St. Paul Apostle, Mukurwe",
        outstations: ["Mukurwe", "Gitiiri", "Thuita", "Nyaga"],
      },
      {
        name: "Most Holy Trinity, Mukarara",
        outstations: ["Mukarara", "Kiunyu", "Kihumbu-ini", "Kiawaihiga", "Gituamba", "Gathanji", "Kiria-ini", "Gatha-ini"],
      },
    ],
  },
  {
    code: "baricho",
    name: "Baricho Deanery",
    parishes: [
      {
        name: "Our Lady of Sorrows, Baricho",
        outstations: ["Baricho", "Njata-ini", "Kiandai", "Kariria", "Riakiania", "Getuya", "Mutitu", "Kianjege East", "Kirimunge", "St. Jude", "Kiburu"],
      },
      {
        name: "Our Lady Consolata, Kagumo",
        outstations: ["Kagumo", "Kabonge", "Karaini", "Waigiri", "Kamuiru", "Gathera", "Mukonyo", "Kiratina", "Kiarugu", "Gatwe"],
      },
      {
        name: "Christ the King, Kiangai",
        outstations: ["Kiangai", "Kiriko", "Mathia", "Ngugu-ini", "Kiaragana", "Thunguri", "Kianwe", "Kiahiti"],
      },
      {
        name: "Sacred Heart of Jesus, Kangaita",
        outstations: ["Kangaita", "Kiairungu", "Thaita", "Mugwandi", "Mbeti", "Nyagithuci", "Mutuma", "Kirang'a"],
      },
      {
        name: "Mary Immaculate, Kerugoya",
        outstations: ["Kerugoya", "Kiamuruga", "Mukinduri", "Ngaru", "Kiandieri", "Kiathi", "Kiaritha", "Mukithi", "Kibingo", "Kaitheri", "Kimandi", "St. John Prison Chapel", "Kabui", "Kirima"],
      },
      {
        name: "St. Paul, Kibingoti",
        outstations: ["Kibingoti", "Kibirigwi", "Njoga", "Kairini", "Kianjege West", "Karinga-ini", "Mukangu", "Mururi-ini"],
      },
      {
        name: "St. Joseph the Worker, Kagio",
        outstations: ["Kagio", "Kandongu", "Kangai", "Kiaga", "Mianya", "Thumaita", "Mukanduini", "Gitooini", "Mugaa", "Kianjogu", "Karii"],
      },
      {
        name: "Presentation of the Lord, Kiang'ombe",
        outstations: ["Kiang'ombe", "Kiangwenyi", "Ithare", "Kathare"],
      },
      {
        name: "Annunciation of the Lord, Gathambi",
        outstations: ["Gathambi", "Ndiriti", "Kiambagathi", "Gathuthuma", "Muragara", "Gituamba", "Kiamaina", "Kiangobe", "Kandegwa"],
      },
    ],
  },
  {
    code: "maragua",
    name: "Maragua Deanery",
    parishes: [
      {
        name: "Holy Family, Maragua",
        outstations: ["Holy Family", "Don Bosco", "Blessed Allamano", "All Saints - Ihiga-ini", "St. Peter & Paul", "St. Joseph", "St. John Evangelist", "St. Francis Assisi", "Sacred Heart", "St. Mary", "St. Patrick", "St. Mark", "St. Charles Lwanga", "St. Paul - Maragua Ridge", "St. Benedict"],
      },
      {
        name: "Holy Cross, Sabasaba",
        outstations: ["Sabasaba", "Thaara", "Igikiro", "Ndorome", "Kahaini", "Kaharati", "Karugia", "Rwanganga", "Wamahiga", "Nyati", "Kahuho", "Karathe"],
      },
      {
        name: "Our Lady of Assumption, Ichagaki",
        outstations: ["Ichagaki", "Itaaga", "Kirima-ini", "Irembu", "Gathigi", "Gicugu", "Githuya", "Kiamwohe", "Mugumo-ini"],
      },
      {
        name: "St. Charles Lwanga, Kenol",
        outstations: ["Kenol", "Methi", "Kagaa", "Kibiku", "Githanji", "Mt. Tarbor Kaburunjui", "Kabati", "Manjuu", "Kimorori", "Queen of the Highway", "St. John the Baptist"],
      },
      {
        name: "St. John Bosco, Makuyu",
        outstations: ["Makuyu", "Doromo Falls", "Gathaiti", "Gathungururu", "Gikono", "Kambiti", "Karung'ang'i", "Maranjau", "Marema", "Kihara", "Mihang'o", "Mugira", "Ndera", "Punda-milia", "Sisal - St. Monica", "Thangira", "Kangangu", "Thaka", "Murang'a Teachers College"],
      },
      {
        name: "Blessed Virgin of Mt. Carmel, Kitito",
        outstations: [],
      },
      {
        name: "Our Lady of Assumption, Ithanga",
        outstations: ["St. Anthony", "St. Elizabeth", "Christ the King", "St. Hellen", "St. Peter", "St. Mulumba", "St. John Paul II", "St. Raphael", "St. Joseph", "St. Teresa", "Our Lady of Mercy", "St. Francis", "Our Lady of Assumption", "Holy Family", "St. Veronica", "St. Bernard", "St. Mary's"],
      },
      {
        name: "St. Joseph Husband of Mary, Muthithi",
        outstations: ["Muthithi", "Ngaburi", "Gikomora", "Kiugu", "Gakeu", "Thamara", "Kagurumo", "Nyagachugu", "Kahethu"],
      },
      {
        name: "Baptism of the Lord, Greystone",
        outstations: ["Greystone", "Kenya Canners", "Mwana Wi Kio", "Kenyatta Farm", "Mangoto", "Nanga", "St. John the Baptist"],
      },
    ],
  },
  {
    code: "gaichanjiru",
    name: "Gaichanjiru Deanery",
    parishes: [
      {
        name: "Queen of All Saints, Gaichanjiru",
        outstations: ["Gaichanjiru", "Ngurwe-ini", "Gakoigo", "Kagira", "Wangai", "Gathige", "Kariti", "Machegecha", "Kagundu", "Rurii", "Mutitu", "Kamoro", "Gatitu", "Mahuria", "Kiharo"],
      },
      {
        name: "St. John the Baptist, Ndonga",
        outstations: ["Ndonga", "Githima", "Gakuyu", "Kianjugu", "Mugumo-Ini", "Thuita"],
      },
      {
        name: "St. Peter the Apostle, Makomboki",
        outstations: ["Kanderendu", "Githaiti", "Kimotho", "Makomboki", "Gituru", "Kiwangenye - St. James", "Kiganjo", "Ngecha", "Gatiani", "Kairitu", "Gitwe", "Kiaria"],
      },
      {
        name: "Divine Mercy, Mununga",
        outstations: ["Mununga", "Gacharage", "Gikoe", "Ndune", "Muthiria", "Gikige", "Boro", "Muchagatha", "Kinyona", "Kagundu"],
      },
      {
        name: "St. John the Baptist, Nguthuru",
        outstations: ["Nguthuru", "Kanyiri-ini", "Makenji", "Githunguri", "Rukira"],
      },
      {
        name: "St. Pius X, Mariira",
        outstations: ["Mariira", "Kigumo", "Kirere", "Kamukabi", "Mutunguru", "Karega", "Gakoe-ini", "Mukuria", "Marumi", "Gatumbi", "Gachocho", "Kahethu", "Irigu-ini", "Mutheru", "Irati"],
      },
      {
        name: "St. Paul the Apostle, Kangari",
        outstations: ["Kangari", "Gichagi-ini", "Karinga", "Kahumbu", "Ikohokoho", "Kiangurwe", "Ikumbi", "Mairi", "Ikuma", "Gitare", "Gitaimbuka", "Njau-ini", "Ngurwe-ini", "Kiangari"],
      },
      {
        name: "Ascension of the Lord, Kariua",
        outstations: ["Kariua", "Gatitu", "Mathare-ini", "Nguku", "Turuturu", "Gituya", "Karia-ini", "Kirirwa", "Kagono"],
      },
    ],
  },
  {
    code: "tuthu",
    name: "Tuthu Deanery",
    parishes: [
      {
        name: "Our Lady Consolata, Tuthu",
        outstations: ["Tuthu", "Karurumo", "Ichichi", "Kianjuru", "Wanjerere", "Kanguru", "Kiangari", "Nduini"],
      },
      {
        name: "Holy Rosary, Kanyenya-ini",
        outstations: ["Kanyenya-ini", "Kiawambogo", "Kihoya", "Kiruri", "Nyagatugu", "Rwathia", "Kibutha"],
      },
      {
        name: "Our Lady of Consolation, Kiria-ini",
        outstations: ["Kiria-ini", "Kiambuthia", "Kamacharia", "Kanjama", "Kagumo-ini", "Ngutu", "Kiangima", "Kora", "Gitugi", "Nyakianga", "Gikoe", "Kirungu", "Kiruru", "Ihuririo"],
      },
      {
        name: "St. Joseph Husband of Mary, Kiangunyi",
        outstations: ["Kiangunyi", "Chuui", "Gakira", "Karirau", "Gikui", "Githiga", "Gitugu", "Gitweku", "Ihiga-ini", "Mary Mother of God - Kagiiko", "Kanorero", "Karung'e", "Kenya Njeru", "Kiairathe", "Koimbi", "Mununga", "Mihuti", "Watuha", "Kahuti"],
      },
      {
        name: "St. Francis Xavier, Muthangari",
        outstations: ["Muthangari", "Gatunguru", "Mioro", "Mirereini", "Kagongo", "Gacharage-ini", "Kihari", "Kiambura", "Ruru", "Nguru-ini", "Kiamututuri", "Kairo"],
      },
      {
        name: "St. Francis Xavier, Kahatia",
        outstations: ["Kahatia", "Gatara", "Gathaithi", "Gatuya", "Githambo", "Kairi-ini", "Kaganda", "Kionjoini", "Matharite", "Murarandia", "Kairichi", "Theri", "St. Peter Muthango", "St. Paul Nyogoti"],
      },
    ],
  },
  {
    code: "kianyaga",
    name: "Kianyaga Deanery",
    parishes: [
      {
        name: "St. Joseph Cottolengo, Kianyaga",
        outstations: ["Kianyaga", "Rwambiti", "Kathaiya", "Githage", "Karucho", "Kiandai", "Kariko", "Kiathi", "Kagongo", "Kiambu"],
      },
      {
        name: "Guardian Angels, Kiamutugu",
        outstations: ["Kiamutugu", "Kibiro-ini", "Kamwana", "Gaciungo", "Mbiri", "Githure", "Karia", "Kiandumu", "St. Benedict - Kianyamau", "Gituba", "Kathataini", "St. Philip Kegwa", "Holy Cross - Kabai"],
      },
      {
        name: "Mary Mother of God, Karumandi",
        outstations: ["Karumandi", "Mucagara", "Thumaita", "Kamugunda", "Kavote", "Kamweti", "Kimunye", "Gatugura", "Karima", "Karuti", "Kathare"],
      },
      {
        name: "Holy Rosary, Kutus",
        outstations: ["Kutus", "Gitwe", "Giacai", "Nyaga", "Gatuto", "Kiamuthambi", "Gakuu", "Kimicha", "Rukenya", "Kiamiciri", "Kianjiru", "Njogu-ini", "Kithiriti", "Kianganga", "Kariara"],
      },
      {
        name: "St. Peter the Apostle, Piai",
        outstations: ["Piai", "Mumbu-ini", "Rogoi", "Togonye", "Ichangi", "Mugamba-ciura", "Gathigi-ini", "Kiaumbui", "Githara-ini", "Itangi", "Karima Dawa", "Munyaka", "Murinduko", "Gold - St. Jude", "Miatuini", "Ikurungu", "Kariati", "Makuti", "St. Josephine Bakhita", "Kamanoro", "Karuangi"],
      },
      {
        name: "St. James the Apostle, Difathas",
        outstations: ["Difathas", "Kamugunda", "Kanjinji", "Ngucwi", "Mururi", "Mbuti", "Kimweas", "Kanjuu", "Gichonjo", "Mutungara", "Mirera", "Rianjuki", "Manga"],
      },
    ],
  },
  {
    code: "mwea",
    name: "Mwea Deanery",
    parishes: [
      {
        name: "St. Peter Clavers, Mwea",
        outstations: ["Karira", "Thiba", "Nguka", "Kiratina", "Rurumi"],
      },
      {
        name: "Epiphany of the Lord, Wang'uru",
        outstations: ["Wang'uru", "Kiamanyeki", "Ndindiruku", "Gathigiriri", "Kiumbu", "Kamucege", "Nyamindi", "Divine Mercy - Murubara"],
      },
      {
        name: "Transfiguration of the Lord, Kimbimbi",
        outstations: ["Kimbimbi", "Kirogo", "Nyangati", "Wamugi", "Kiorugari", "Mahigaini", "Ngucwi"],
      },
      {
        name: "Our Lady of Consolata, Sagana",
        outstations: ["Githuguya", "Kiambiti", "Kanjai", "Karima", "Kiangwaci", "Gacharu", "Kimathi", "Riandira", "Thangathi", "Gathenge", "Mitundu", "Kanjoya", "Kabwe", "Rukanga", "Thanju", "Our Lady of Consolata - Sagana"],
      },
      {
        name: "St. Theresa of the Child Jesus, Karaba",
        outstations: ["Karaba", "Gatuiri", "Marurumo", "Ngang'a", "Kiandegwa", "Makutano", "Kirwara", "Ng'othi", "Mutithi", "Makongeni", "Kwihota", "Holy Rosary", "Gitomboto"],
      },
    ],
  },
];

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function churchMetrics(deaneryIndex: number, parishIndex: number, churchIndex: number, outstationName: string, parishName: string): LocalChurch {
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
    id: `${slug(parishName)}-${slug(outstationName)}`,
    name: outstationName,
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
  code: deanery.code,
  name: deanery.name,
  parishes: deanery.parishes.map((parish, parishIndex) => ({
    id: `${deanery.code}-${slug(parish.name)}`,
    name: parish.name,
    churches: parish.outstations.map((outstationName, churchIndex) =>
      churchMetrics(deaneryIndex, parishIndex, churchIndex, outstationName, parish.name),
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
    venue: "Murang'a Cathedral Grounds",
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
    parish: "Sacred Heart of Jesus Cathedral",
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
    parish: "St. Joseph the Worker, Kagio",
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
    parish: "St. Joseph Cottolengo, Kianyaga",
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
  { id: "WF-2026-014", category: "Mental Health", urgency: "high", parish: "St. Joseph the Worker, Kagio", opened: "5h ago", assigned: "Fr. James" },
  { id: "WF-2026-013", category: "Early Pregnancy", urgency: "high", parish: "Anonymous", opened: "1d ago", assigned: "Sr. Mary" },
  { id: "WF-2026-012", category: "Substance Abuse", urgency: "medium", parish: "Holy Family, Maragua", opened: "2d ago", assigned: "Fr. Paul" },
  { id: "WF-2026-011", category: "School Fees", urgency: "low", parish: "St. Paul the Apostle, Kangari", opened: "4d ago", assigned: "Office" },
  { id: "WF-2026-010", category: "Family Crisis", urgency: "medium", parish: "Our Lady of Consolation, Kiria-ini", opened: "6d ago", assigned: "Fr. James" },
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
