# Supabase Setup Instructions

## Storage Buckets Setup

This application requires the following storage buckets to be set up in Supabase:

1. `submissions` - For storing submission documents
2. `avatars` - For storing user profile pictures
3. `chat-attachments` - For storing attachments sent in chat

### Setting up buckets via the Supabase Dashboard

1. Log in to your Supabase dashboard
2. Navigate to the "Storage" section
3. Click "Create bucket" for each of the required buckets
4. Set the following settings for each bucket:
   - Public bucket: Yes
   - File size limit: 50MB (or as needed)

### Setting up RLS policies

Run the SQL migration in `supabase/migrations/20230503000000_create_storage_buckets.sql` to set up the required RLS policies.

Alternatively, you can set up the policies manually via the Supabase dashboard:

1. Navigate to the "Storage" section
2. Click on the "Policies" tab
3. Create policies that allow:
   - Authenticated users to upload files
   - Public access to read files
   - Users to access their own files

## Environment Variables

Ensure the following environment variables are set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Database Schema

Run the SQL migrations in the `supabase/migrations` directory to set up the required database schema.
