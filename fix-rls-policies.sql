-- Fix RLS policies to allow seeding

-- BULLETIN CATEGORIES
DROP POLICY IF EXISTS "bulletin_categories_insert" ON public.bulletin_categories;
CREATE POLICY "bulletin_categories_insert"
ON public.bulletin_categories FOR INSERT
WITH CHECK (TRUE);

-- YFP CURRICULA
DROP POLICY IF EXISTS "yfp_curricula_insert" ON public.yfp_curricula;
CREATE POLICY "yfp_curricula_insert"
ON public.yfp_curricula FOR INSERT
WITH CHECK (TRUE);

-- YFP PILLARS
DROP POLICY IF EXISTS "yfp_pillars_insert" ON public.yfp_pillars;
CREATE POLICY "yfp_pillars_insert"
ON public.yfp_pillars FOR INSERT
WITH CHECK (TRUE);

-- YFP ARTICLES
DROP POLICY IF EXISTS "yfp_articles_insert" ON public.yfp_articles;
CREATE POLICY "yfp_articles_insert"
ON public.yfp_articles FOR INSERT
WITH CHECK (TRUE);
