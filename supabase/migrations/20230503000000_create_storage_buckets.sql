-- This migration should be run by an admin or during project setup
-- It creates the necessary storage buckets and sets appropriate policies

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
CREATE POLICY "Allow authenticated users to upload files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'submissions');

-- Allow authenticated users to select their own files
CREATE POLICY "Allow authenticated users to select their own files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'submissions' AND auth.uid() = owner);

-- Allow public access to read files
CREATE POLICY "Allow public access to read files"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'submissions');

-- Set up similar policies for avatars and chat-attachments
-- Avatars
CREATE POLICY "Allow authenticated users to upload avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Allow public access to read avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- Chat attachments
CREATE POLICY "Allow authenticated users to upload chat attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-attachments');

CREATE POLICY "Allow authenticated users to select chat attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'chat-attachments');
