-- Create activity logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    submission_id UUID REFERENCES public.submissions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    comment TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on activity_logs
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for activity_logs
CREATE POLICY "Activity logs are viewable by authenticated users" 
    ON public.activity_logs FOR SELECT 
    USING (auth.role() = 'authenticated');

CREATE POLICY "Activity logs are insertable by authenticated users" 
    ON public.activity_logs FOR INSERT 
    WITH CHECK (auth.role() = 'authenticated');

-- Make sure submissions table has the necessary columns
DO $$
BEGIN
    -- Check if comments column exists, if not add it
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'submissions' 
        AND column_name = 'comments'
    ) THEN
        ALTER TABLE public.submissions ADD COLUMN comments JSONB;
    END IF;
    
    -- Check if isFirstParty column exists, if not add it
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'submissions' 
        AND column_name = 'isFirstParty'
    ) THEN
        ALTER TABLE public.submissions ADD COLUMN isFirstParty BOOLEAN DEFAULT FALSE;
    END IF;
    
    -- Check if submission_id column exists, if not add it
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'submissions' 
        AND column_name = 'submission_id'
    ) THEN
        ALTER TABLE public.submissions ADD COLUMN submission_id TEXT UNIQUE;
    END IF;
END
$$;

-- Add policies for better security
DO $$
BEGIN
    -- Ensure RLS is enabled
    ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies if they exist to avoid conflicts
    DROP POLICY IF EXISTS "Submissions are viewable by authenticated users" ON public.submissions;
    DROP POLICY IF EXISTS "Submissions are insertable by anyone" ON public.submissions;
    DROP POLICY IF EXISTS "Submissions are updatable by authenticated users" ON public.submissions;
    
    -- Create new policies
    CREATE POLICY "Submissions are viewable by authenticated users" 
        ON public.submissions FOR SELECT 
        USING (auth.role() = 'authenticated');
    
    CREATE POLICY "Submissions are insertable by anyone" 
        ON public.submissions FOR INSERT 
        TO public;
    
    CREATE POLICY "Submissions are updatable by authenticated users" 
        ON public.submissions FOR UPDATE 
        USING (auth.role() = 'authenticated');
END
$$;
