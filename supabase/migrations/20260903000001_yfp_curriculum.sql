-- Create yfp_curricula table
CREATE TABLE IF NOT EXISTS public.yfp_curricula (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
);

-- Create yfp_pillars table
CREATE TABLE IF NOT EXISTS public.yfp_pillars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  curriculum_id UUID NOT NULL REFERENCES public.yfp_curricula(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
  UNIQUE(curriculum_id, name)
);

-- Create yfp_articles table
CREATE TABLE IF NOT EXISTS public.yfp_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  curriculum_id UUID NOT NULL REFERENCES public.yfp_curricula(id) ON DELETE CASCADE,
  pillar_id UUID NOT NULL REFERENCES public.yfp_pillars(id) ON DELETE CASCADE,
  article_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  scriptural_references TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  discussion_points TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
  UNIQUE(curriculum_id, pillar_id, article_number)
);

-- Create yfp_youth_progress table (for Phase 2)
CREATE TABLE IF NOT EXISTS public.yfp_youth_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  youth_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  article_id UUID NOT NULL REFERENCES public.yfp_articles(id) ON DELETE CASCADE,
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
  UNIQUE(youth_id, article_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_yfp_pillars_curriculum_id
ON public.yfp_pillars(curriculum_id);

CREATE INDEX IF NOT EXISTS idx_yfp_articles_curriculum_id
ON public.yfp_articles(curriculum_id);

CREATE INDEX IF NOT EXISTS idx_yfp_articles_pillar_id
ON public.yfp_articles(pillar_id);

CREATE INDEX IF NOT EXISTS idx_yfp_youth_progress_youth_id
ON public.yfp_youth_progress(youth_id);

CREATE INDEX IF NOT EXISTS idx_yfp_youth_progress_article_id
ON public.yfp_youth_progress(article_id);

-- Enable RLS on all YFP tables
ALTER TABLE public.yfp_curricula ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.yfp_pillars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.yfp_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.yfp_youth_progress ENABLE ROW LEVEL SECURITY;

-- YFP_CURRICULA Policies
-- Admins can see/manage all curricula in their org
DROP POLICY IF EXISTS "yfp_curricula_select" ON public.yfp_curricula;
DROP POLICY IF EXISTS "yfp_curricula_insert" ON public.yfp_curricula;
DROP POLICY IF EXISTS "yfp_curricula_update" ON public.yfp_curricula;
DROP POLICY IF EXISTS "yfp_curricula_delete" ON public.yfp_curricula;

CREATE POLICY "yfp_curricula_select"
ON public.yfp_curricula FOR SELECT
USING (
  is_active = TRUE
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'staff')
  )
);

CREATE POLICY "yfp_curricula_insert"
ON public.yfp_curricula FOR INSERT
WITH CHECK (TRUE);

CREATE POLICY "yfp_curricula_update"
ON public.yfp_curricula FOR UPDATE
USING (
  auth.role() = 'service_role'
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'staff')
  )
)
WITH CHECK (
  auth.role() = 'service_role'
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'staff')
  )
);

CREATE POLICY "yfp_curricula_delete"
ON public.yfp_curricula FOR DELETE
USING (
  auth.role() = 'service_role'
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);

-- YFP_PILLARS Policies
DROP POLICY IF EXISTS "yfp_pillars_select" ON public.yfp_pillars;
DROP POLICY IF EXISTS "yfp_pillars_insert" ON public.yfp_pillars;
DROP POLICY IF EXISTS "yfp_pillars_update" ON public.yfp_pillars;
DROP POLICY IF EXISTS "yfp_pillars_delete" ON public.yfp_pillars;

CREATE POLICY "yfp_pillars_select"
ON public.yfp_pillars FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.yfp_curricula c
    WHERE c.id = curriculum_id
    AND c.is_active = TRUE
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'staff')
  )
);

CREATE POLICY "yfp_pillars_insert"
ON public.yfp_pillars FOR INSERT
WITH CHECK (TRUE);

CREATE POLICY "yfp_pillars_update"
ON public.yfp_pillars FOR UPDATE
USING (
  auth.role() = 'service_role'
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'staff')
  )
)
WITH CHECK (
  auth.role() = 'service_role'
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'staff')
  )
);

CREATE POLICY "yfp_pillars_delete"
ON public.yfp_pillars FOR DELETE
USING (
  auth.role() = 'service_role'
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);

-- YFP_ARTICLES Policies
DROP POLICY IF EXISTS "yfp_articles_select" ON public.yfp_articles;
DROP POLICY IF EXISTS "yfp_articles_insert" ON public.yfp_articles;
DROP POLICY IF EXISTS "yfp_articles_update" ON public.yfp_articles;
DROP POLICY IF EXISTS "yfp_articles_delete" ON public.yfp_articles;

CREATE POLICY "yfp_articles_select"
ON public.yfp_articles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.yfp_curricula c
    WHERE c.id = curriculum_id
    AND c.is_active = TRUE
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'staff')
  )
);

CREATE POLICY "yfp_articles_insert"
ON public.yfp_articles FOR INSERT
WITH CHECK (TRUE);

CREATE POLICY "yfp_articles_update"
ON public.yfp_articles FOR UPDATE
USING (
  auth.role() = 'service_role'
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'staff')
  )
)
WITH CHECK (
  auth.role() = 'service_role'
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'staff')
  )
);

CREATE POLICY "yfp_articles_delete"
ON public.yfp_articles FOR DELETE
USING (
  auth.role() = 'service_role'
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);

-- YFP_YOUTH_PROGRESS Policies (Phase 2)
DROP POLICY IF EXISTS "yfp_youth_progress_select" ON public.yfp_youth_progress;
DROP POLICY IF EXISTS "yfp_youth_progress_insert" ON public.yfp_youth_progress;
DROP POLICY IF EXISTS "yfp_youth_progress_update" ON public.yfp_youth_progress;
DROP POLICY IF EXISTS "yfp_youth_progress_delete" ON public.yfp_youth_progress;

-- Youth can only see/manage their own progress
CREATE POLICY "yfp_youth_progress_select"
ON public.yfp_youth_progress FOR SELECT
USING (
  youth_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'staff')
  )
);

CREATE POLICY "yfp_youth_progress_insert"
ON public.yfp_youth_progress FOR INSERT
WITH CHECK (
  youth_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'staff')
  )
);

CREATE POLICY "yfp_youth_progress_update"
ON public.yfp_youth_progress FOR UPDATE
USING (
  youth_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'staff')
  )
)
WITH CHECK (
  youth_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'staff')
  )
);

CREATE POLICY "yfp_youth_progress_delete"
ON public.yfp_youth_progress FOR DELETE
USING (
  youth_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);
