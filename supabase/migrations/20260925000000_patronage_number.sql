-- =========================================================
-- Add Patron Number (Unique Identifier)
-- Similar to CDM numbers for youths
-- =========================================================

-- Add patron_number column
ALTER TABLE public.patronage_team
ADD COLUMN patron_number text UNIQUE;

-- Create function to generate patron number (for use in trigger)
CREATE OR REPLACE FUNCTION generate_patron_number()
RETURNS trigger AS $$
DECLARE
  next_num bigint;
  patron_num text;
BEGIN
  -- Get the next sequential number
  SELECT COALESCE(MAX(CAST(SUBSTRING(patron_number FROM 12) AS bigint)), 0) + 1
  INTO next_num
  FROM patronage_team
  WHERE patron_number LIKE 'PAT-%-%';

  -- Format: PAT-YYYY-NNNNN (5 digits, zero-padded)
  patron_num := 'PAT-' || EXTRACT(YEAR FROM CURRENT_DATE) || '-' || LPAD(next_num::text, 5, '0');

  NEW.patron_number := patron_num;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to generate patron number (for backfilling existing records)
CREATE OR REPLACE FUNCTION get_next_patron_number()
RETURNS text AS $$
DECLARE
  next_num bigint;
  patron_num text;
BEGIN
  -- Get the next sequential number
  SELECT COALESCE(MAX(CAST(SUBSTRING(patron_number FROM 12) AS bigint)), 0) + 1
  INTO next_num
  FROM patronage_team
  WHERE patron_number LIKE 'PAT-%-%';

  -- Format: PAT-YYYY-NNNNN (5 digits, zero-padded)
  patron_num := 'PAT-' || EXTRACT(YEAR FROM CURRENT_DATE) || '-' || LPAD(next_num::text, 5, '0');

  RETURN patron_num;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate patron number on insert
CREATE TRIGGER patronage_team_generate_patron_number
  BEFORE INSERT ON public.patronage_team
  FOR EACH ROW
  WHEN (NEW.patron_number IS NULL)
  EXECUTE FUNCTION generate_patron_number();

-- Generate patron numbers for existing records
UPDATE public.patronage_team
SET patron_number = get_next_patron_number()
WHERE patron_number IS NULL;

-- Create index on patron_number for faster lookups
CREATE INDEX IF NOT EXISTS patronage_team_patron_number_idx ON public.patronage_team(patron_number);
