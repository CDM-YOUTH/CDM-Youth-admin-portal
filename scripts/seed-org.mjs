/**
 * Seed deaneries, parishes, and outstations from the official directory list.
 * Run: node scripts/seed-org.mjs
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://linthhfiydxukbhjgfcz.supabase.co";
const SUPABASE_ANON_KEY =
  "sb_publishable_xn366EHKcH1OiaZ_KRv_DQ_2wRSbIFt";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── Source data ────────────────────────────────────────────────────────────

const ORG = [
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

// ─── Seeding logic ──────────────────────────────────────────────────────────

async function seed() {
  console.log("Seeding deaneries…");

  // 1. Upsert deaneries
  const { data: deaneryRows, error: dErr } = await supabase
    .from("deaneries")
    .upsert(
      ORG.map((d) => ({ code: d.code, name: d.name })),
      { onConflict: "code", ignoreDuplicates: false }
    )
    .select("id, code");

  if (dErr) { console.error("Deanery error:", dErr); process.exit(1); }

  const deaneryIdByCode = Object.fromEntries(deaneryRows.map((r) => [r.code, r.id]));
  console.log(`  ✓ ${deaneryRows.length} deaneries`);

  // 2. Upsert parishes
  const parishPayload = ORG.flatMap((d) =>
    d.parishes.map((p) => ({
      deanery_id: deaneryIdByCode[d.code],
      name: p.name,
    }))
  );

  console.log("Seeding parishes…");
  const { data: parishRows, error: pErr } = await supabase
    .from("parishes")
    .upsert(parishPayload, { onConflict: "deanery_id,name", ignoreDuplicates: false })
    .select("id, deanery_id, name");

  if (pErr) { console.error("Parish error:", pErr); process.exit(1); }

  // Build lookup: deanery_code + parish_name → parish_id
  const deaneryCodeById = Object.fromEntries(deaneryRows.map((r) => [r.id, r.code]));
  const parishIdByKey = Object.fromEntries(
    parishRows.map((r) => [`${deaneryCodeById[r.deanery_id]}::${r.name}`, r.id])
  );
  console.log(`  ✓ ${parishRows.length} parishes`);

  // 3. Upsert outstations in batches (to avoid request size limits)
  const outstationPayload = ORG.flatMap((d) =>
    d.parishes.flatMap((p) =>
      p.outstations.map((name) => ({
        parish_id: parishIdByKey[`${d.code}::${p.name}`],
        name,
      }))
    )
  );

  console.log(`Seeding ${outstationPayload.length} outstations…`);

  const BATCH = 200;
  let inserted = 0;
  for (let i = 0; i < outstationPayload.length; i += BATCH) {
    const batch = outstationPayload.slice(i, i + BATCH);
    const { error: oErr } = await supabase
      .from("outstations")
      .upsert(batch, { onConflict: "parish_id,name", ignoreDuplicates: false });

    if (oErr) { console.error(`Outstation batch ${i / BATCH + 1} error:`, oErr); process.exit(1); }
    inserted += batch.length;
    process.stdout.write(`\r  ✓ ${inserted}/${outstationPayload.length}`);
  }
  console.log("\nDone.");
}

seed().catch((err) => { console.error(err); process.exit(1); });
