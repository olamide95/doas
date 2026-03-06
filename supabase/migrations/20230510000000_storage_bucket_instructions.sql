-- IMPORTANT: This migration contains instructions for manually creating the storage bucket
-- Please follow these steps in the Supabase dashboard:

-- 1. Go to the Supabase dashboard for your project
-- 2. Navigate to the "Storage" section
-- 3. Click "Create bucket"
-- 4. Enter "submissions" as the bucket name
-- 5. Check "Public bucket" to make it publicly accessible
-- 6. Click "Create bucket" to create it

-- After creating the bucket, add these RLS policies:

-- For public read access:
-- CREATE POLICY "Allow public access to submissions bucket" ON storage.objects
-- FOR SELECT TO public
-- USING (bucket_id = 'submissions');

-- For public upload access:
-- CREATE POLICY "Allow public uploads to submissions bucket" ON storage.objects
-- FOR INSERT TO public
-- WITH CHECK (bucket_id = 'submissions');

-- These policies can be added in the Supabase dashboard under Storage > Policies
