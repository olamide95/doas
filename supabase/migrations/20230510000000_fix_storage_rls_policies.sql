-- First, make sure the submissions bucket exists
DO $$
BEGIN
    -- Check if the bucket exists
    IF NOT EXISTS (
        SELECT 1 FROM storage.buckets WHERE name = 'submissions'
    ) THEN
        -- Create the bucket if it doesn't exist
        INSERT INTO storage.buckets (id, name, public)
        VALUES ('submissions', 'submissions', true);
    END IF;
END $$;

-- Drop existing policies for the submissions bucket
DROP POLICY IF EXISTS "Allow public uploads to submissions bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow public access to submissions bucket" ON storage.objects;

-- Create policy to allow anyone to upload to the submissions bucket
CREATE POLICY "Allow public uploads to submissions bucket" ON storage.objects
FOR INSERT TO public
WITH CHECK (bucket_id = 'submissions');

-- Create policy to allow anyone to read from the submissions bucket
CREATE POLICY "Allow public access to submissions bucket" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'submissions');

-- Make sure the bucket is set to public
UPDATE storage.buckets
SET public = true
WHERE name = 'submissions';
