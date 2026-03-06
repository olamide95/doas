-- Enable Row Level Security for all storage buckets
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create policies for the submissions bucket
CREATE POLICY "Allow public read access for submissions" 
ON storage.objects FOR SELECT
USING (bucket_id = 'submissions');

CREATE POLICY "Allow authenticated users to upload to submissions" 
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'submissions');

CREATE POLICY "Allow users to update their own submissions" 
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'submissions' AND auth.uid() = owner);

CREATE POLICY "Allow users to delete their own submissions" 
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'submissions' AND auth.uid() = owner);

-- Create policies for the avatars bucket
CREATE POLICY "Allow public read access for avatars" 
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Allow authenticated users to upload avatars" 
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Allow users to update their own avatars" 
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars' AND auth.uid() = owner);

CREATE POLICY "Allow users to delete their own avatars" 
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars' AND auth.uid() = owner);

-- Create policies for the chat-attachments bucket
CREATE POLICY "Allow public read access for chat-attachments" 
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-attachments');

CREATE POLICY "Allow authenticated users to upload chat-attachments" 
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-attachments');

CREATE POLICY "Allow users to update their own chat-attachments" 
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'chat-attachments' AND auth.uid() = owner);

CREATE POLICY "Allow users to delete their own chat-attachments" 
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'chat-attachments' AND auth.uid() = owner);
