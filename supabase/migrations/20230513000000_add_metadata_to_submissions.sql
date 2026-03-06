-- Add metadata column to submissions table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'submissions'
        AND column_name = 'metadata'
    ) THEN
        ALTER TABLE submissions ADD COLUMN metadata JSONB;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'submissions'
        AND column_name = 'is_first_party'
    ) THEN
        ALTER TABLE submissions ADD COLUMN is_first_party BOOLEAN DEFAULT false;
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
