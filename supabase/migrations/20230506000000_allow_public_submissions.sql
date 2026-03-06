-- Allow public submissions to the submissions table
ALTER TABLE submissions
ALTER COLUMN submitter_id DROP NOT NULL;

-- Add submission_id column for tracking public submissions
ALTER TABLE submissions
ADD COLUMN IF NOT EXISTS submission_id TEXT;

-- Create index on submission_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_submissions_submission_id ON submissions(submission_id);

-- Update RLS policies for the submissions table
DROP POLICY IF EXISTS "Allow public submissions" ON submissions;
CREATE POLICY "Allow public submissions" ON submissions
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Update RLS policies for the submissions bucket
DROP POLICY IF EXISTS "Allow public uploads to submissions bucket" ON storage.objects;
CREATE POLICY "Allow public uploads to submissions bucket" ON storage.objects
  FOR INSERT
  TO public
  WITH CHECK (bucket_id = 'submissions');

-- Allow public to read from submissions bucket
DROP POLICY IF EXISTS "Allow public to read from submissions bucket" ON storage.objects;
CREATE POLICY "Allow public to read from submissions bucket" ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'submissions');
