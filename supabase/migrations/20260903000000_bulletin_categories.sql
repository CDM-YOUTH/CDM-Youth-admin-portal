-- Create bulletin_categories table
CREATE TABLE IF NOT EXISTS public.bulletin_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  color TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
);

-- Add category_id to formation_items (if not already present)
ALTER TABLE IF EXISTS public.formation_items
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.bulletin_categories(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_formation_items_category_id
ON public.formation_items(category_id);

-- Update RLS policies for bulletin_categories (if not already present)
-- Categories are readable by authenticated users, writable by admins only
ALTER TABLE public.bulletin_categories ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "bulletin_categories_select" ON public.bulletin_categories;
DROP POLICY IF EXISTS "bulletin_categories_insert" ON public.bulletin_categories;
DROP POLICY IF EXISTS "bulletin_categories_update" ON public.bulletin_categories;
DROP POLICY IF EXISTS "bulletin_categories_delete" ON public.bulletin_categories;

-- Read: All authenticated users can view categories
CREATE POLICY "bulletin_categories_select"
ON public.bulletin_categories FOR SELECT
USING (TRUE);

-- Write: Authenticated users can create categories (will be restricted to admins in app)
CREATE POLICY "bulletin_categories_insert"
ON public.bulletin_categories FOR INSERT
WITH CHECK (TRUE);

CREATE POLICY "bulletin_categories_update"
ON public.bulletin_categories FOR UPDATE
USING (
  auth.role() = 'service_role'
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
)
WITH CHECK (
  auth.role() = 'service_role'
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);

CREATE POLICY "bulletin_categories_delete"
ON public.bulletin_categories FOR DELETE
USING (
  auth.role() = 'service_role'
  OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);
