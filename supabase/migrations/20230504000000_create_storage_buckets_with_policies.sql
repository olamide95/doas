-- This migration creates the necessary storage buckets and sets appropriate policies
-- It should be run by a Supabase admin or during project setup

-- Create the submissions bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('submissions', 'submissions', true)
ON CONFLICT (id) DO NOTHING;

-- Create the avatars bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Create the chat-attachments bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for the submissions bucket
-- Allow authenticated users to upload files
CREATE POLICY IF NOT EXISTS "Allow authenticated users to upload files to submissions"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'submissions');

-- Allow authenticated users to select their own files
CREATE POLICY IF NOT EXISTS "Allow authenticated users to select their own files from submissions"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'submissions');

-- Allow public access to read files
CREATE POLICY IF NOT EXISTS "Allow public access to read files from submissions"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'submissions');

-- Set up similar policies for avatars
CREATE POLICY IF NOT EXISTS "Allow authenticated users to upload avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY IF NOT EXISTS "Allow public access to read avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- Set up similar policies for chat attachments
CREATE POLICY IF NOT EXISTS "Allow authenticated users to upload chat attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-attachments');

CREATE POLICY IF NOT EXISTS "Allow authenticated users to select chat attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'chat-attachments');
