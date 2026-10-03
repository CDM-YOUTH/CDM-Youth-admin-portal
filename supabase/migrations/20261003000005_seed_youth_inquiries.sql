-- Seed Youth Inquiries test data for Questions Desk testing

INSERT INTO public.yfp_youth_inquiries (
  inquiry_reference,
  submitted_by,
  submitted_at,
  question_text,
  status,
  upvotes_count,
  linked_article_id,
  linked_article_title
) VALUES
  (
    '#YFP-2026-0814',
    '{"name":"Kevin Mwangi","parish":"St. Mary''s Deanery","fellowship":"Murang''a Youth Fellowship"}'::jsonb,
    '2026-01-18T16:18:00Z',
    'How do we practically explain the Trinity (Three persons, One God) to our non-Catholic friends at university without confusing them?',
    'Needs_Answer',
    14,
    NULL,
    NULL
  ),
  (
    '#YFP-2026-0813',
    '{"name":"Agnes Njeri","parish":"Kandra Deanery","fellowship":"Catechesis Youth Group"}'::jsonb,
    '2026-01-18T20:35:00Z',
    'Does Sunday obligation still apply during long academic breaks?',
    'Drafted',
    9,
    NULL,
    'Liturgy • Jan Wk 3'
  ),
  (
    '#YFP-2026-0812',
    '{"name":"Brian Kimani","parish":"Gatanga Deanery","fellowship":"Relationships Pillar"}'::jsonb,
    '2026-01-17T20:40:00Z',
    'Christian dating boundaries; How early should young Catholics think about marriage?',
    'Approved_For_Bulletin',
    18,
    NULL,
    'Relationships Pillar'
  ),
  (
    '#YFP-2026-0811',
    '{"name":"Dominic Kamau","parish":"Kangema Deanery","fellowship":"Entrepreneurship Youth"}'::jsonb,
    '2026-01-16T23:15:00Z',
    'Can a Catholic youth invest in digital currencies or forex without confusing them?',
    'Needs_Answer',
    11,
    NULL,
    NULL
  ),
  (
    '#YFP-2026-0810',
    '{"name":"Mary Wanjiru","parish":"Maragua Deanery","fellowship":"Pastoral Care Team"}'::jsonb,
    '2026-01-15T14:22:00Z',
    'What should Catholic youth know about mental health and seeking counseling?',
    'Confidential_Pastoral',
    7,
    NULL,
    NULL
  ),
  (
    '#YFP-2026-0809',
    '{"name":"Peter Ochieng","parish":"Murang''a North Deanery","fellowship":"Campus Ministry"}'::jsonb,
    '2026-01-14T09:45:00Z',
    'How do we balance studies, work, and active parish involvement as young adults?',
    'Drafted',
    13,
    NULL,
    NULL
  ),
  (
    '#YFP-2026-0808',
    '{"name":"Grace Mwangi","parish":"Gatanga Deanery","fellowship":"Liturgy Team"}'::jsonb,
    '2026-01-12T17:30:00Z',
    'What is the significance of the different liturgical colors and seasons in the Church calendar?',
    'Approved_For_Bulletin',
    6,
    NULL,
    NULL
  ),
  (
    '#YFP-2026-0807',
    '{"name":"Samuel Kipchoge","parish":"Kandara Deanery","fellowship":"Youth Leaders Network"}'::jsonb,
    '2026-01-10T11:20:00Z',
    'How can youth leaders effectively mentor younger members in their faith journey?',
    'Needs_Answer',
    8,
    NULL,
    NULL
  ),
  (
    '#YFP-2026-0806',
    '{"name":"Lucia Mwende","parish":"Murang''a Central Deanery","fellowship":"Women''s Faith Group"}'::jsonb,
    '2026-01-08T15:55:00Z',
    'What does the Church teach about the role of women in leadership within parishes?',
    'Approved_For_Bulletin',
    21,
    NULL,
    NULL
  ),
  (
    '#YFP-2026-0805',
    '{"name":"Mwangi Njoroge","parish":"Nairobi North Deanery","fellowship":"Justice & Peace"}'::jsonb,
    '2026-01-05T13:10:00Z',
    'How do we address climate change as a matter of Catholic social teaching?',
    'Drafted',
    10,
    NULL,
    NULL
  );

-- Update pastoral responses for approved inquiries
UPDATE public.yfp_youth_inquiries
SET pastoral_response = '{"response":"Marriage is a sacrament, not just a cultural milestone. Young Catholics should approach dating with intentionality and prayer. Focus on building friendships first, understanding each other''s faith commitment, and ensuring shared values.","respondent":"Fr. Charles Waweru (Youth Chaplain)"}'::jsonb
WHERE inquiry_reference = '#YFP-2026-0812';

UPDATE public.yfp_youth_inquiries
SET pastoral_response = '{"response":"Mental health is part of holistic wellness. Seeking professional help is not a sign of weak faith—it''s practicing stewardship of your mind and body. Many Catholic counselors integrate faith into therapy.","respondent":"Sister Catherine Muthoni (Pastoral Counselor)"}'::jsonb
WHERE inquiry_reference = '#YFP-2026-0810';

UPDATE public.yfp_youth_inquiries
SET pastoral_response = '{"response":"Liturgical colors help us enter the mystery of Christ''s life. Purple speaks of penance, white of purity and resurrection, red of martyrdom and Pentecost, green of hope and growth. Each color deepens our participation in the liturgy.","respondent":"Rev. John Kariuki (Liturgy Director)"}'::jsonb
WHERE inquiry_reference = '#YFP-2026-0808';

UPDATE public.yfp_youth_inquiries
SET pastoral_response = '{"response":"The Church values women''s gifts and calls them to active participation. While priestly ordination is reserved to men, women serve as catechists, lectors, cantors, pastoral leaders, and advisors. Their voices are essential in parish governance and spiritual formation.","respondent":"Bishop Augustine Waweru (Diocese)"}'::jsonb
WHERE inquiry_reference = '#YFP-2026-0806';
