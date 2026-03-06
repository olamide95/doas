-- Update the submissions table to include all the fields needed for the forms
ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS applicantName TEXT,
ADD COLUMN IF NOT EXISTS contactPhoneNumber TEXT,
ADD COLUMN IF NOT EXISTS areaCouncilEmail TEXT,
ADD COLUMN IF NOT EXISTS addressLine1 TEXT,
ADD COLUMN IF NOT EXISTS addressLine2 TEXT,
ADD COLUMN IF NOT EXISTS companyName TEXT,
ADD COLUMN IF NOT EXISTS companyAddress TEXT,
ADD COLUMN IF NOT EXISTS companyRegistrationNumber TEXT,
ADD COLUMN IF NOT EXISTS purposeOfApplication TEXT,
ADD COLUMN IF NOT EXISTS applicationType TEXT,
ADD COLUMN IF NOT EXISTS gpsCoordinates TEXT,
ADD COLUMN IF NOT EXISTS structureDuration TEXT,
ADD COLUMN IF NOT EXISTS numberOfSigns TEXT,
ADD COLUMN IF NOT EXISTS typeOfSign TEXT,
ADD COLUMN IF NOT EXISTS signDimensions TEXT,
ADD COLUMN IF NOT EXISTS structuralHeight TEXT,
ADD COLUMN IF NOT EXISTS practitionerName TEXT,
ADD COLUMN IF NOT EXISTS practitionerLicenseNumber TEXT,
ADD COLUMN IF NOT EXISTS eiaReportURL TEXT,
ADD COLUMN IF NOT EXISTS soilTestReportURL TEXT,
ADD COLUMN IF NOT EXISTS proofOfPaymentURL TEXT,
ADD COLUMN IF NOT EXISTS structuralEngineeringDrawingsURL TEXT,
ADD COLUMN IF NOT EXISTS practitionerLicenseURL TEXT,
ADD COLUMN IF NOT EXISTS companyRegistrationURL TEXT,
ADD COLUMN IF NOT EXISTS isFirstParty BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS comments JSONB DEFAULT '[]'::jsonb;

-- Create storage buckets if they don't exist
-- Note: This needs to be done through the Supabase dashboard or API
-- Create buckets: submissions, avatars, chat-attachments
