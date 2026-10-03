-- Remove old restrictive constraint and ensure new one exists
-- This aggressively removes any unique constraint that blocks multiple articles per year

-- Drop dependent tables first (in correct order)
DROP TABLE IF EXISTS public.yfp_youth_inquiries CASCADE;
DROP TABLE IF EXISTS public.yfp_weekly_articles CASCADE;

-- Recreate with correct schema
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
  author JSONB,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Published', 'Scheduled', 'Draft')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
  published_at TIMESTAMP WITH TIME ZONE,
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by UUID
);
-- No unique constraint on week_number - allow multiple articles per week per sub-pillar per year

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_yfp_weekly_articles_pillar_id ON public.yfp_weekly_articles(pillar_id);
CREATE INDEX IF NOT EXISTS idx_yfp_weekly_articles_sub_pillar_id ON public.yfp_weekly_articles(sub_pillar_id);
CREATE INDEX IF NOT EXISTS idx_yfp_weekly_articles_status ON public.yfp_weekly_articles(status);
CREATE INDEX IF NOT EXISTS idx_yfp_weekly_articles_sunday_date ON public.yfp_weekly_articles(sunday_date);

-- Re-create youth_inquiries table with correct foreign key
CREATE TABLE public.yfp_youth_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_reference TEXT NOT NULL UNIQUE,
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

CREATE INDEX IF NOT EXISTS idx_yfp_youth_inquiries_status ON public.yfp_youth_inquiries(status);
CREATE INDEX IF NOT EXISTS idx_yfp_youth_inquiries_linked_article_id ON public.yfp_youth_inquiries(linked_article_id);
CREATE INDEX IF NOT EXISTS idx_yfp_youth_inquiries_upvotes ON public.yfp_youth_inquiries(upvotes_count DESC);

-- Re-enable RLS
ALTER TABLE public.yfp_weekly_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.yfp_youth_inquiries ENABLE ROW LEVEL SECURITY;

-- Recreate RLS policies
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
