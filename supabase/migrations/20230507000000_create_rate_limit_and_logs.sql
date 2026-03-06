-- Create rate limits table for basic rate limiting
CREATE TABLE IF NOT EXISTS rate_limits (
  id SERIAL PRIMARY KEY,
  ip TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  last_request TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(ip)
);

-- Create upload logs table for auditing
CREATE TABLE IF NOT EXISTS upload_logs (
  id SERIAL PRIMARY KEY,
  bucket TEXT NOT NULL,
  path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_type TEXT NOT NULL,
  ip TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  user_id UUID REFERENCES auth.users(id)
);

-- Add indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_rate_limits_ip ON rate_limits(ip);
CREATE INDEX IF NOT EXISTS idx_upload_logs_created_at ON upload_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_upload_logs_ip ON upload_logs(ip);
