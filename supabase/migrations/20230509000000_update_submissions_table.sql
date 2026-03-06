-- Make sure the submissions table has all the necessary columns
ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Pending',
ADD COLUMN IF NOT EXISTS isFirstParty BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS submission_id TEXT,
ADD COLUMN IF NOT EXISTS applicantName TEXT,
ADD COLUMN IF NOT EXISTS contactPhoneNumber TEXT,
ADD COLUMN IF NOT EXISTS areaCouncilEmail TEXT,
ADD COLUMN IF NOT EXISTS addressLine1 TEXT,
ADD COLUMN IF NOT EXISTS addressLine2 TEXT,
ADD COLUMN IF NOT EXISTS purposeOfApplication TEXT,
ADD COLUMN IF NOT EXISTS applicationType TEXT,
ADD COLUMN IF NOT EXISTS gpsCoordinates TEXT,
ADD COLUMN IF NOT EXISTS structureDuration TEXT,
ADD COLUMN IF NOT EXISTS numberOfSigns TEXT,
ADD COLUMN IF NOT EXISTS typeOfSign TEXT,
ADD COLUMN IF NOT EXISTS signDimensions TEXT,
ADD COLUMN IF NOT EXISTS structuralHeight TEXT,
ADD COLUMN IF NOT EXISTS companyName TEXT,
ADD COLUMN IF NOT EXISTS companyAddress TEXT,
ADD COLUMN IF NOT EXISTS companyRegistrationNumber TEXT,
ADD COLUMN IF NOT EXISTS practitionerName TEXT,
ADD COLUMN IF NOT EXISTS practitionerLicenseNumber TEXT,
ADD COLUMN IF NOT EXISTS eiaReportURL TEXT,
ADD COLUMN IF NOT EXISTS soilTestReportURL TEXT,
ADD COLUMN IF NOT EXISTS proofOfPaymentURL TEXT,
ADD COLUMN IF NOT EXISTS structuralEngineeringDrawingsURL TEXT,
ADD COLUMN IF NOT EXISTS practitionerLicenseURL TEXT,
ADD COLUMN IF NOT EXISTS companyRegistrationURL TEXT,
ADD COLUMN IF NOT EXISTS comments JSONB DEFAULT '[]'::jsonb;

-- Update RLS policies to allow public submissions
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- Policy for public submissions (no authentication required)
DROP POLICY IF EXISTS "Allow public submissions" ON submissions;
CREATE POLICY "Allow public submissions" ON submissions
  FOR INSERT
  TO public
  WITH CHECK (true);  -- Allow anyone to insert

-- Policy for reading own submissions
DROP POLICY IF EXISTS "Allow reading own submissions" ON submissions;
CREATE POLICY "Allow reading own submissions" ON submissions
  FOR SELECT
  TO public
  USING (submission_id IS NOT NULL);  -- Allow reading any submission with an ID

-- Make sure the storage bucket has the right permissions
DROP POLICY IF EXISTS "Allow public uploads" ON storage.objects;
CREATE POLICY "Allow public uploads" ON storage.objects
  FOR INSERT
  TO public
  WITH CHECK (bucket_id = 'submissions');
