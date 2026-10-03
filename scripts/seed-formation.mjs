import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Load .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, "../.env");
const envContent = fs.readFileSync(envPath, "utf-8");
const envVars = {};

envContent.split("\n").forEach((line) => {
  const [key, ...valueParts] = line.split("=");
  if (key && valueParts.length > 0) {
    const value = valueParts.join("=").replace(/^["']|["']$/g, "");
    envVars[key.trim()] = value;
  }
});

const supabase = createClient(envVars.SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

async function seedFormation() {
  console.log("🌱 Seeding Formation data...\n");

  try {
    // Seed Bulletin Categories
    console.log("📁 Creating Bulletin categories...");
    const categories = [
      {
        name: "Scripture Study",
        description: "Bible passages, exegesis, and scriptural reflection",
        icon: "📖",
        color: "#1e40af",
        sort_order: 1,
      },
      {
        name: "Prayer & Spirituality",
        description: "Prayer guides, meditations, and contemplative practices",
        icon: "🙏",
        color: "#7c3aed",
        sort_order: 2,
      },
      {
        name: "Sacraments",
        description: "Eucharist, Reconciliation, Baptism, and Confirmation",
        icon: "⛪",
        color: "#0891b2",
        sort_order: 3,
      },
      {
        name: "Moral Formation",
        description: "Virtues, Ten Commandments, and ethical living",
        icon: "✝️",
        color: "#ca8a04",
        sort_order: 4,
      },
      {
        name: "Youth Ministry",
        description: "Resources for youth groups, leadership, and community",
        icon: "👥",
        color: "#dc2626",
        sort_order: 5,
      },
      {
        name: "Social Justice",
        description: "Corporal and spiritual works of mercy, service, and outreach",
        icon: "🤝",
        color: "#16a34a",
        sort_order: 6,
      },
    ];

    const { data: createdCategories, error: categoryError } = await supabase
      .from("bulletin_categories")
      .insert(categories)
      .select();

    if (categoryError) throw categoryError;
    console.log(`✅ Created ${createdCategories.length} categories\n`);

    // Seed YFP Curricula
    console.log("📚 Creating YFP curriculum...");
    const curriculumData = {
      title: "YFP 2026 Main Track",
      description:
        "Complete Youth Formation Program curriculum covering faith, spirituality, and discipleship",
      is_active: true,
    };

    const { data: curriculum, error: curriculumError } = await supabase
      .from("yfp_curricula")
      .insert(curriculumData)
      .select()
      .single();

    if (curriculumError) throw curriculumError;
    console.log(`✅ Created curriculum: ${curriculum.title}\n`);

    // Seed YFP Pillars
    console.log("🏛️ Creating YFP pillars...");
    const pillars = [
      {
        curriculum_id: curriculum.id,
        name: "Foundation",
        description: "Core faith: Trinity, Creation, God's love, calling",
        icon: "🏛️",
        color: "#1e40af",
        sort_order: 1,
      },
      {
        curriculum_id: curriculum.id,
        name: "Spiritual Life",
        description: "Holy Spirit, Prayer, Grace, Sacraments, Virtues",
        icon: "🙏",
        color: "#7c3aed",
        sort_order: 2,
      },
      {
        curriculum_id: curriculum.id,
        name: "Church & Community",
        description: "Body of Christ, Communion of Saints, discipleship",
        icon: "⛪",
        color: "#0891b2",
        sort_order: 3,
      },
      {
        curriculum_id: curriculum.id,
        name: "Moral Living",
        description: "Conscience, Ten Commandments, sin/repentance, freedom",
        icon: "✝️",
        color: "#ca8a04",
        sort_order: 4,
      },
      {
        curriculum_id: curriculum.id,
        name: "Mission & Witness",
        description: "Evangelization, service, prophetic voice, martyrs",
        icon: "💪",
        color: "#dc2626",
        sort_order: 5,
      },
      {
        curriculum_id: curriculum.id,
        name: "Relationships & Life",
        description: "Family, friendship, sexuality, vocation, marriage",
        icon: "👨‍👩‍👧‍👦",
        color: "#16a34a",
        sort_order: 6,
      },
    ];

    const { data: createdPillars, error: pillarError } = await supabase
      .from("yfp_pillars")
      .insert(pillars)
      .select();

    if (pillarError) throw pillarError;
    console.log(`✅ Created ${createdPillars.length} pillars\n`);

    // Seed Sample YFP Articles
    console.log("📖 Creating sample YFP articles...");
    const articles = [
      {
        curriculum_id: curriculum.id,
        pillar_id: createdPillars[0].id,
        article_number: 1,
        title: "Called by Christ: Our Foundation",
        content:
          "In the beginning, before all time, God knew us and called us into being. Our faith begins with understanding that we are not accidents, but purposefully created in the image and likeness of God.",
        scriptural_references: ["Jn 1:1", "Mt 16:18", "Jer 1:5"],
        tags: ["foundation", "calling", "faith"],
      },
      {
        curriculum_id: curriculum.id,
        pillar_id: createdPillars[0].id,
        article_number: 2,
        title: "God's Love: The Source",
        content:
          "God's love is the fundamental reality of existence. It is not earned, not conditional, and not based on our merit. We are loved simply because God is love.",
        scriptural_references: ["Jn 3:16", "1 Jn 4:7-8", "Rom 5:8"],
        tags: ["love", "grace", "God"],
      },
      {
        curriculum_id: curriculum.id,
        pillar_id: createdPillars[1].id,
        article_number: 3,
        title: "The Holy Spirit: Our Guide",
        content:
          "The Holy Spirit is the third person of the Trinity, the breath of divine life that sustains and empowers us. Jesus promised the Advocate who would guide us into all truth.",
        scriptural_references: ["Jn 14:26", "Acts 2:38", "Rom 8:9"],
        tags: ["holiness", "spirit", "guidance"],
      },
      {
        curriculum_id: curriculum.id,
        pillar_id: createdPillars[1].id,
        article_number: 4,
        title: "Prayer: Conversation with God",
        content:
          "Prayer is our primary means of communion with God. It is not just asking for things, but developing a relationship with the Father through Jesus in the Holy Spirit.",
        scriptural_references: ["Mt 6:6", "1 Thes 5:17", "Jn 15:4-5"],
        tags: ["prayer", "communion", "faith"],
      },
      {
        curriculum_id: curriculum.id,
        pillar_id: createdPillars[2].id,
        article_number: 5,
        title: "Body of Christ",
        content:
          "We are members of the Church, the Body of Christ. Each of us has a unique role to play in building up the Kingdom of God through our gifts and talents.",
        scriptural_references: ["1 Cor 12:12-27", "Eph 4:4-6", "Rom 12:4-8"],
        tags: ["church", "community", "unity"],
      },
      {
        curriculum_id: curriculum.id,
        pillar_id: createdPillars[3].id,
        article_number: 6,
        title: "Conscience: The Voice Within",
        content:
          "Conscience is the inner voice that helps us discern right from wrong. It is not infallible, but must be educated and formed by the teachings of Christ and the Church.",
        scriptural_references: ["Rom 12:2", "1 Tim 1:5", "Tit 1:15"],
        tags: ["conscience", "morality", "virtue"],
      },
    ];

    const { data: createdArticles, error: articleError } = await supabase
      .from("yfp_articles")
      .insert(articles)
      .select();

    if (articleError) throw articleError;
    console.log(`✅ Created ${createdArticles.length} sample articles\n`);

    console.log("✨ Seeding complete!");
    console.log("\n📊 Summary:");
    console.log(`   • ${createdCategories.length} Bulletin categories`);
    console.log(`   • 1 YFP curriculum`);
    console.log(`   • ${createdPillars.length} YFP pillars`);
    console.log(`   • ${createdArticles.length} YFP articles`);
    console.log("\n🚀 Ready to view in the admin panel!\n");
  } catch (error) {
    console.error("❌ Error seeding data:", error.message);
    process.exit(1);
  }
}

seedFormation();
