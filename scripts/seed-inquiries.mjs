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

// Use anon key which works with the INSERT policy that has WITH CHECK (TRUE)
const supabase = createClient(envVars.VITE_SUPABASE_URL, envVars.VITE_SUPABASE_PUBLISHABLE_KEY);

async function seedInquiries() {
  console.log("🌱 Seeding Youth Inquiries test data...\n");

  try {
    // Sample inquiries
    const inquiries = [
      {
        inquiry_reference: "#YFP-2026-0814",
        submitted_by: {
          name: "Kevin Mwangi",
          parish: "St. Mary's Deanery",
          fellowship: "Murang'a Youth Fellowship",
        },
        submitted_at: new Date("2026-01-18T16:18:00").toISOString(),
        question_text:
          "How do we practically explain the Trinity (Three persons, One God) to our non-Catholic friends at university without confusing them?",
        status: "Needs_Answer",
        upvotes_count: 14,
        linked_article_id: null,
        linked_article_title: null,
      },
      {
        inquiry_reference: "#YFP-2026-0813",
        submitted_by: {
          name: "Agnes Njeri",
          parish: "Kandra Deanery",
          fellowship: "Catechesis Youth Group",
        },
        submitted_at: new Date("2026-01-18T20:35:00").toISOString(),
        question_text: "Does Sunday obligation still apply during long academic breaks?",
        status: "Drafted",
        upvotes_count: 9,
        linked_article_id: null,
        linked_article_title: "Liturgy • Jan Wk 3",
      },
      {
        inquiry_reference: "#YFP-2026-0812",
        submitted_by: {
          name: "Brian Kimani",
          parish: "Gatanga Deanery",
          fellowship: "Relationships Pillar",
        },
        submitted_at: new Date("2026-01-17T20:40:00").toISOString(),
        question_text:
          "Christian dating boundaries; How early should young Catholics think about marriage?",
        status: "Approved_For_Bulletin",
        upvotes_count: 18,
        pastoral_response: {
          response:
            "Marriage is a sacrament, not just a cultural milestone. Young Catholics should approach dating with intentionality and prayer. Focus on building friendships first, understanding each other's faith commitment, and ensuring shared values.",
          respondent: "Fr. Charles Waweru (Youth Chaplain)",
        },
        linked_article_id: null,
        linked_article_title: "Relationships Pillar",
      },
      {
        inquiry_reference: "#YFP-2026-0811",
        submitted_by: {
          name: "Dominic Kamau",
          parish: "Kangema Deanery",
          fellowship: "Entrepreneurship Youth",
        },
        submitted_at: new Date("2026-01-16T23:15:00").toISOString(),
        question_text:
          "Can a Catholic youth invest in digital currencies or forex without confusing them?",
        status: "Needs_Answer",
        upvotes_count: 11,
        linked_article_id: null,
        linked_article_title: null,
      },
      {
        inquiry_reference: "#YFP-2026-0810",
        submitted_by: {
          name: "Mary Wanjiru",
          parish: "Maragua Deanery",
          fellowship: "Pastoral Care Team",
        },
        submitted_at: new Date("2026-01-15T14:22:00").toISOString(),
        question_text:
          "What should Catholic youth know about mental health and seeking counseling?",
        status: "Confidential_Pastoral",
        upvotes_count: 7,
        pastoral_response: {
          response:
            "Mental health is part of holistic wellness. Seeking professional help is not a sign of weak faith—it's practicing stewardship of your mind and body. Many Catholic counselors integrate faith into therapy.",
          respondent: "Sister Catherine Muthoni (Pastoral Counselor)",
        },
        linked_article_id: null,
        linked_article_title: null,
      },
      {
        inquiry_reference: "#YFP-2026-0809",
        submitted_by: {
          name: "Peter Ochieng",
          parish: "Murang'a North Deanery",
          fellowship: "Campus Ministry",
        },
        submitted_at: new Date("2026-01-14T09:45:00").toISOString(),
        question_text:
          "How do we balance studies, work, and active parish involvement as young adults?",
        status: "Drafted",
        upvotes_count: 13,
        linked_article_id: null,
        linked_article_title: null,
      },
      {
        inquiry_reference: "#YFP-2026-0808",
        submitted_by: {
          name: "Grace Mwangi",
          parish: "Gatanga Deanery",
          fellowship: "Liturgy Team",
        },
        submitted_at: new Date("2026-01-12T17:30:00").toISOString(),
        question_text:
          "What is the significance of the different liturgical colors and seasons in the Church calendar?",
        status: "Approved_For_Bulletin",
        upvotes_count: 6,
        pastoral_response: {
          response:
            "Liturgical colors help us enter the mystery of Christ's life. Purple speaks of penance, white of purity and resurrection, red of martyrdom and Pentecost, green of hope and growth. Each color deepens our participation in the liturgy.",
          respondent: "Rev. John Kariuki (Liturgy Director)",
        },
        linked_article_id: null,
        linked_article_title: null,
      },
      {
        inquiry_reference: "#YFP-2026-0807",
        submitted_by: {
          name: "Samuel Kipchoge",
          parish: "Kandara Deanery",
          fellowship: "Youth Leaders Network",
        },
        submitted_at: new Date("2026-01-10T11:20:00").toISOString(),
        question_text:
          "How can youth leaders effectively mentor younger members in their faith journey?",
        status: "Needs_Answer",
        upvotes_count: 8,
        linked_article_id: null,
        linked_article_title: null,
      },
      {
        inquiry_reference: "#YFP-2026-0806",
        submitted_by: {
          name: "Lucia Mwende",
          parish: "Murang'a Central Deanery",
          fellowship: "Women's Faith Group",
        },
        submitted_at: new Date("2026-01-08T15:55:00").toISOString(),
        question_text:
          "What does the Church teach about the role of women in leadership within parishes?",
        status: "Approved_For_Bulletin",
        upvotes_count: 21,
        pastoral_response: {
          response:
            "The Church values women's gifts and calls them to active participation. While priestly ordination is reserved to men, women serve as catechists, lectors, cantors, pastoral leaders, and advisors. Their voices are essential in parish governance and spiritual formation.",
          respondent: "Bishop Augustine Waweru (Diocese)",
        },
        linked_article_id: null,
        linked_article_title: null,
      },
      {
        inquiry_reference: "#YFP-2026-0805",
        submitted_by: {
          name: "Mwangi Njoroge",
          parish: "Nairobi North Deanery",
          fellowship: "Justice & Peace",
        },
        submitted_at: new Date("2026-01-05T13:10:00").toISOString(),
        question_text: "How do we address climate change as a matter of Catholic social teaching?",
        status: "Drafted",
        upvotes_count: 10,
        linked_article_id: null,
        linked_article_title: null,
      },
    ];

    console.log(`📝 Inserting ${inquiries.length} test inquiries...\n`);

    const { data: createdInquiries, error: inquiryError } = await supabase
      .from("yfp_youth_inquiries")
      .insert(inquiries)
      .select();

    if (inquiryError) throw inquiryError;

    console.log(`✅ Successfully created ${createdInquiries.length} inquiries!\n`);

    // Summary by status
    const byStatus = {};
    createdInquiries.forEach((inq) => {
      byStatus[inq.status] = (byStatus[inq.status] || 0) + 1;
    });

    console.log("📊 Inquiries by Status:");
    Object.entries(byStatus).forEach(([status, count]) => {
      console.log(`  • ${status.replace(/_/g, " ")}: ${count}`);
    });

    console.log("\n✨ Seeding complete!");
  } catch (error) {
    console.error("❌ Error seeding inquiries:", error.message);
    process.exit(1);
  }
}

seedInquiries();
