-- Add materials column to yfp_weekly_articles for file uploads
-- Stores metadata for uploaded files (images and PDFs)
-- Structure: [{ url, name, type, uploadedAt }, ...]

ALTER TABLE public.yfp_weekly_articles
ADD COLUMN materials JSONB DEFAULT '[]';

-- Add index for faster queries if filtering by materials
CREATE INDEX IF NOT EXISTS idx_yfp_weekly_articles_has_materials
ON public.yfp_weekly_articles
USING gin(materials);

-- Add comment explaining the structure
COMMENT ON COLUMN public.yfp_weekly_articles.materials IS
'Array of uploaded file metadata. Each object contains: url (CDN URL), name (filename), type (image|pdf), uploadedAt (ISO timestamp)';
