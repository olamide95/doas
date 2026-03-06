-- First, ensure the submissions table exists
CREATE TABLE IF NOT EXISTS submissions (
    id SERIAL PRIMARY KEY,
    submission_id TEXT UNIQUE,
    title TEXT,
    description TEXT,
    status TEXT DEFAULT 'Pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    content JSONB -- Store all form data as JSON
);

-- Add any missing columns that we need
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'submissions'
        AND column_name = 'content'
    ) THEN
        ALTER TABLE submissions ADD COLUMN content JSONB;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'submissions'
        AND column_name = 'submission_id'
    ) THEN
        ALTER TABLE submissions ADD COLUMN submission_id TEXT UNIQUE;
    END IF;
END
$$;

-- Update RLS policies to allow public submissions
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public submissions" ON submissions;
DROP POLICY IF EXISTS "Allow authenticated users to read submissions" ON submissions;

-- Create new policies
CREATE POLICY "Allow public submissions" ON submissions
    FOR INSERT
    TO public
    WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read submissions" ON submissions
    FOR SELECT
    TO authenticated
    USING (true);
