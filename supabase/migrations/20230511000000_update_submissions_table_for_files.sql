-- Add columns for file metadata if they don't exist
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS eiaReportName TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS eiaReportSize INTEGER;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS eiaReportType TEXT;

ALTER TABLE submissions ADD COLUMN IF NOT EXISTS soilTestReportName TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS soilTestReportSize INTEGER;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS soilTestReportType TEXT;

ALTER TABLE submissions ADD COLUMN IF NOT EXISTS proofOfPaymentName TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS proofOfPaymentSize INTEGER;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS proofOfPaymentType TEXT;

ALTER TABLE submissions ADD COLUMN IF NOT EXISTS structuralEngineeringDrawingsName TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS structuralEngineeringDrawingsSize INTEGER;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS structuralEngineeringDrawingsType TEXT;

ALTER TABLE submissions ADD COLUMN IF NOT EXISTS files_attached BOOLEAN DEFAULT FALSE;

-- Ensure RLS policy exists for public submissions
DROP POLICY IF EXISTS "Allow public submissions" ON submissions;
CREATE POLICY "Allow public submissions" ON submissions
  FOR INSERT
  TO public
  WITH CHECK (true);
