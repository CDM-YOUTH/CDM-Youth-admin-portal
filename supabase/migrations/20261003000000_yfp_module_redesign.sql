-- =========================================================
-- YFP Module Redesign (2026 Specification)
-- Formation Pillars, Sub-Pillars, Weekly Articles, Youth Inquiries
-- =========================================================

-- Clean up if needed (drop in reverse order of dependencies)
DROP TABLE IF EXISTS public.yfp_youth_inquiries CASCADE;
DROP TABLE IF EXISTS public.yfp_weekly_articles CASCADE;
DROP TABLE IF EXISTS public.yfp_sub_pillars CASCADE;
DROP TABLE IF EXISTS public.yfp_pillars CASCADE;

-- =========================================================
-- YFP_PILLARS: Formation Pillars with Color Scheme
-- =========================================================
CREATE TABLE public.yfp_pillars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  canonical_index INTEGER NOT NULL UNIQUE,
  description TEXT,
  color_scheme JSONB DEFAULT '{"background_fill":"#fff1f2","border_stroke":"#881337","accent_hex":"#881337"}',
  icon TEXT DEFAULT 'menu_book',
  has_sub_pillars BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by UUID
);

-- =========================================================
-- YFP_SUB_PILLARS: Grade Tracks within Pillars
-- =========================================================
CREATE TABLE public.yfp_sub_pillars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pillar_id UUID NOT NULL REFERENCES public.yfp_pillars(id) ON DELETE CASCADE,
  track_number TEXT NOT NULL,
  title TEXT NOT NULL,
  age_cohort TEXT,
  curriculum_scope TEXT,
  total_sessions INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Draft', 'Archived')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by UUID,
  UNIQUE(pillar_id, track_number),
  UNIQUE(pillar_id, title)
);

-- =========================================================
-- YFP_WEEKLY_ARTICLES: Weekly Formation Content
-- =========================================================
CREATE TABLE public.yfp_weekly_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pillar_id UUID NOT NULL REFERENCES public.yfp_pillars(id) ON DELETE CASCADE,
  sub_pillar_id UUID REFERENCES public.yfp_sub_pillars(id) ON DELETE CASCADE,
  liturgical_year INTEGER NOT NULL,
  month TEXT NOT NULL,
  week_number INTEGER NOT NULL,
  sunday_date DATE NOT NULL,
  liturgical_calendar_title TEXT,
  article_title TEXT NOT NULL,
  handbook_page_reference TEXT,
  scripture_citations JSONB DEFAULT '[]',
  guided_reflection_questions TEXT[] DEFAULT '{}',
  pastoral_directive TEXT,
  -- Author info as JSONB
  author JSONB,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Published', 'Scheduled', 'Draft')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
  published_at TIMESTAMP WITH TIME ZONE,
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by UUID,
  UNIQUE(pillar_id, sub_pillar_id, liturgical_year, week_number)
);

-- =========================================================
-- YFP_YOUTH_INQUIRIES: Youth Questions Desk
-- =========================================================
CREATE TABLE public.yfp_youth_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_reference TEXT NOT NULL UNIQUE,
  -- Submitted by info as JSONB
  submitted_by JSONB,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
  linked_article_id UUID REFERENCES public.yfp_weekly_articles(id) ON DELETE SET NULL,
  linked_article_title TEXT,
  question_text TEXT NOT NULL,
  upvotes_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Needs_Answer' CHECK (status IN ('Needs_Answer', 'Drafted', 'Approved_For_Bulletin', 'Confidential_Pastoral')),
  pastoral_response JSONB,
  distribution_targets JSONB DEFAULT '{"print_in_next_sunday_bulletin":false,"bulletin_target_date":null,"broadcast_mobile_feed":false,"push_notification_to_inquirer":false,"confidential_pastoral_only":false}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by UUID
);

-- =========================================================
-- INDEXES
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_yfp_pillars_canonical_index ON public.yfp_pillars(canonical_index);
CREATE INDEX IF NOT EXISTS idx_yfp_pillars_has_sub_pillars ON public.yfp_pillars(has_sub_pillars);
CREATE INDEX IF NOT EXISTS idx_yfp_sub_pillars_pillar_id ON public.yfp_sub_pillars(pillar_id);
CREATE INDEX IF NOT EXISTS idx_yfp_sub_pillars_status ON public.yfp_sub_pillars(status);
CREATE INDEX IF NOT EXISTS idx_yfp_weekly_articles_pillar_id ON public.yfp_weekly_articles(pillar_id);
CREATE INDEX IF NOT EXISTS idx_yfp_weekly_articles_sub_pillar_id ON public.yfp_weekly_articles(sub_pillar_id);
CREATE INDEX IF NOT EXISTS idx_yfp_weekly_articles_status ON public.yfp_weekly_articles(status);
CREATE INDEX IF NOT EXISTS idx_yfp_weekly_articles_sunday_date ON public.yfp_weekly_articles(sunday_date);
CREATE INDEX IF NOT EXISTS idx_yfp_youth_inquiries_status ON public.yfp_youth_inquiries(status);
CREATE INDEX IF NOT EXISTS idx_yfp_youth_inquiries_linked_article_id ON public.yfp_youth_inquiries(linked_article_id);
CREATE INDEX IF NOT EXISTS idx_yfp_youth_inquiries_upvotes ON public.yfp_youth_inquiries(upvotes_count DESC);

-- =========================================================
-- ENABLE RLS
-- =========================================================
ALTER TABLE public.yfp_pillars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.yfp_sub_pillars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.yfp_weekly_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.yfp_youth_inquiries ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- RLS POLICIES: YFP_PILLARS
-- =========================================================
DROP POLICY IF EXISTS "yfp_pillars_select" ON public.yfp_pillars;
DROP POLICY IF EXISTS "yfp_pillars_insert" ON public.yfp_pillars;
DROP POLICY IF EXISTS "yfp_pillars_update" ON public.yfp_pillars;
DROP POLICY IF EXISTS "yfp_pillars_delete" ON public.yfp_pillars;

CREATE POLICY "yfp_pillars_select"
ON public.yfp_pillars FOR SELECT
USING (deleted_at IS NULL);

CREATE POLICY "yfp_pillars_insert"
ON public.yfp_pillars FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'staff', 'moderator')
  )
);

CREATE POLICY "yfp_pillars_update"
ON public.yfp_pillars FOR UPDATE
USING (
  deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'staff', 'moderator')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'staff', 'moderator')
  )
);

CREATE POLICY "yfp_pillars_delete"
ON public.yfp_pillars FOR DELETE
USING (
  deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'staff')
  )
);

-- =========================================================
-- RLS POLICIES: YFP_SUB_PILLARS
-- =========================================================
DROP POLICY IF EXISTS "yfp_sub_pillars_select" ON public.yfp_sub_pillars;
DROP POLICY IF EXISTS "yfp_sub_pillars_insert" ON public.yfp_sub_pillars;
DROP POLICY IF EXISTS "yfp_sub_pillars_update" ON public.yfp_sub_pillars;
DROP POLICY IF EXISTS "yfp_sub_pillars_delete" ON public.yfp_sub_pillars;

CREATE POLICY "yfp_sub_pillars_select"
ON public.yfp_sub_pillars FOR SELECT
USING (deleted_at IS NULL);

CREATE POLICY "yfp_sub_pillars_insert"
ON public.yfp_sub_pillars FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'staff', 'moderator')
  )
);

CREATE POLICY "yfp_sub_pillars_update"
ON public.yfp_sub_pillars FOR UPDATE
USING (
  deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'staff', 'moderator')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'staff', 'moderator')
  )
);

CREATE POLICY "yfp_sub_pillars_delete"
ON public.yfp_sub_pillars FOR DELETE
USING (
  deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'staff')
  )
);

-- =========================================================
-- RLS POLICIES: YFP_WEEKLY_ARTICLES
-- =========================================================
DROP POLICY IF EXISTS "yfp_weekly_articles_select" ON public.yfp_weekly_articles;
DROP POLICY IF EXISTS "yfp_weekly_articles_insert" ON public.yfp_weekly_articles;
DROP POLICY IF EXISTS "yfp_weekly_articles_update" ON public.yfp_weekly_articles;
DROP POLICY IF EXISTS "yfp_weekly_articles_delete" ON public.yfp_weekly_articles;

CREATE POLICY "yfp_weekly_articles_select"
ON public.yfp_weekly_articles FOR SELECT
USING (deleted_at IS NULL);

CREATE POLICY "yfp_weekly_articles_insert"
ON public.yfp_weekly_articles FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'staff', 'moderator')
  )
);

CREATE POLICY "yfp_weekly_articles_update"
ON public.yfp_weekly_articles FOR UPDATE
USING (
  deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'staff', 'moderator')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'staff', 'moderator')
  )
);

CREATE POLICY "yfp_weekly_articles_delete"
ON public.yfp_weekly_articles FOR DELETE
USING (
  deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'staff')
  )
);

-- =========================================================
-- RLS POLICIES: YFP_YOUTH_INQUIRIES
-- =========================================================
DROP POLICY IF EXISTS "yfp_youth_inquiries_select" ON public.yfp_youth_inquiries;
DROP POLICY IF EXISTS "yfp_youth_inquiries_insert" ON public.yfp_youth_inquiries;
DROP POLICY IF EXISTS "yfp_youth_inquiries_update" ON public.yfp_youth_inquiries;
DROP POLICY IF EXISTS "yfp_youth_inquiries_delete" ON public.yfp_youth_inquiries;

CREATE POLICY "yfp_youth_inquiries_select"
ON public.yfp_youth_inquiries FOR SELECT
USING (
  deleted_at IS NULL
  AND (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'staff', 'moderator')
    )
    OR status != 'Confidential_Pastoral'
  )
);

CREATE POLICY "yfp_youth_inquiries_insert"
ON public.yfp_youth_inquiries FOR INSERT
WITH CHECK (TRUE);

CREATE POLICY "yfp_youth_inquiries_update"
ON public.yfp_youth_inquiries FOR UPDATE
USING (
  deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'staff', 'moderator')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'staff', 'moderator')
  )
);

CREATE POLICY "yfp_youth_inquiries_delete"
ON public.yfp_youth_inquiries FOR DELETE
USING (
  deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);
