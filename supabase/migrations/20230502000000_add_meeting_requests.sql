-- Create meeting_requests table
CREATE TABLE IF NOT EXISTS meeting_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  organization TEXT,
  purpose TEXT NOT NULL,
  preferred_date DATE NOT NULL,
  preferred_time TEXT NOT NULL,
  urgency TEXT NOT NULL,
  supporting_document_url TEXT,
  status TEXT NOT NULL DEFAULT 'Pending',
  department TEXT NOT NULL DEFAULT 'CSU',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  scheduled_date TIMESTAMP WITH TIME ZONE,
  comments JSONB DEFAULT '[]'::jsonb
);

-- Create indexes for meeting_requests
CREATE INDEX IF NOT EXISTS idx_meeting_requests_status ON meeting_requests(status);
CREATE INDEX IF NOT EXISTS idx_meeting_requests_department ON meeting_requests(department);
CREATE INDEX IF NOT EXISTS idx_meeting_requests_preferred_date ON meeting_requests(preferred_date);

-- Add RLS policies for meeting_requests
ALTER TABLE meeting_requests ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert their own meeting requests
CREATE POLICY insert_meeting_requests ON meeting_requests
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Allow users to view their own meeting requests
CREATE POLICY select_own_meeting_requests ON meeting_requests
  FOR SELECT TO authenticated
  USING (email = auth.jwt() ->> 'email');

-- Allow staff to view all meeting requests
CREATE POLICY select_all_meeting_requests ON meeting_requests
  FOR SELECT TO authenticated
  USING (auth.jwt() ->> 'role' IN ('director', 'csu', 'planning', 'monitoring', 'finance'));

-- Allow staff to update meeting requests
CREATE POLICY update_meeting_requests ON meeting_requests
  FOR UPDATE TO authenticated
  USING (auth.jwt() ->> 'role' IN ('director', 'csu', 'planning', 'monitoring', 'finance'));
