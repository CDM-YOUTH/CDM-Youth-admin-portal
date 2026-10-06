-- ============ FINANCE MODULE MIGRATION ============
-- Step 1: Core tables for assessments and payment tracking

-- Create parish_assessments table
CREATE TABLE IF NOT EXISTS parish_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parish_id UUID NOT NULL REFERENCES parishes(id) ON DELETE CASCADE,
  deanery_id UUID NOT NULL REFERENCES deaneries(id),
  fiscal_year INTEGER NOT NULL,
  category_id UUID NOT NULL REFERENCES financial_categories(id),
  category_type TEXT NOT NULL,
  amount_due DECIMAL(12,2) NOT NULL DEFAULT 0,
  headcount INTEGER,
  amount_paid DECIMAL(12,2) NOT NULL DEFAULT 0,
  is_historical_arrears BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (parish_id, fiscal_year, category_id)
);

-- Create payment_allocations table
CREATE TABLE IF NOT EXISTS payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES parish_payments(id) ON DELETE CASCADE,
  assessment_id UUID NOT NULL REFERENCES parish_assessments(id) ON DELETE CASCADE,
  allocated_amount DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add columns to parish_payments
ALTER TABLE parish_payments ADD COLUMN IF NOT EXISTS deanery_id UUID REFERENCES deaneries(id);
ALTER TABLE parish_payments ADD COLUMN IF NOT EXISTS payment_by TEXT;
ALTER TABLE parish_payments ADD COLUMN IF NOT EXISTS receipt_issued BOOLEAN DEFAULT FALSE;
ALTER TABLE parish_payments ADD COLUMN IF NOT EXISTS receipt_number TEXT;

-- Trigger: Update amount_paid when payment allocations change
CREATE OR REPLACE FUNCTION update_assessment_payment()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE parish_assessments
  SET amount_paid = COALESCE((SELECT SUM(allocated_amount) FROM payment_allocations WHERE assessment_id = NEW.assessment_id), 0),
      updated_at = NOW()
  WHERE id = NEW.assessment_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_assessment_payment ON payment_allocations;
CREATE TRIGGER trigger_update_assessment_payment AFTER INSERT OR UPDATE ON payment_allocations FOR EACH ROW EXECUTE FUNCTION update_assessment_payment();

-- Trigger: Update amount_paid when allocations deleted
CREATE OR REPLACE FUNCTION delete_assessment_payment()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE parish_assessments
  SET amount_paid = COALESCE((SELECT SUM(allocated_amount) FROM payment_allocations WHERE assessment_id = OLD.assessment_id), 0),
      updated_at = NOW()
  WHERE id = OLD.assessment_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_delete_assessment_payment ON payment_allocations;
CREATE TRIGGER trigger_delete_assessment_payment AFTER DELETE ON payment_allocations FOR EACH ROW EXECUTE FUNCTION delete_assessment_payment();

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_parish_assessments_parish_year ON parish_assessments(parish_id, fiscal_year);
CREATE INDEX IF NOT EXISTS idx_parish_assessments_category ON parish_assessments(category_id, fiscal_year);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_assessment ON payment_allocations(assessment_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment ON payment_allocations(payment_id);
