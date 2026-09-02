-- ============================================================================
-- Majestic Computers ERP - Geolocation Staff Attendance Migration
-- Safe & Additive Migration (Uses IF NOT EXISTS and ADD COLUMN IF NOT EXISTS)
-- ============================================================================

-- 1. Ensure required extensions exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Add Geolocation columns to branches table
ALTER TABLE branches ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS attendance_radius_meters INTEGER DEFAULT 5;

-- 3. Add Attendance Token to users table (Private per-staff token)
ALTER TABLE users ADD COLUMN IF NOT EXISTS attendance_token UUID DEFAULT gen_random_uuid();

-- Ensure all existing users receive a unique attendance token if null
UPDATE users SET attendance_token = gen_random_uuid() WHERE attendance_token IS NULL;

-- Create unique index on attendance_token if it does not already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'idx_users_attendance_token'
  ) THEN
    CREATE UNIQUE INDEX idx_users_attendance_token ON users(attendance_token);
  END IF;
END $$;

-- 4. Create attendance_logs table
CREATE TABLE IF NOT EXISTS attendance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  user_name VARCHAR(255),
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  branch_name VARCHAR(255),
  type VARCHAR(10) CHECK (type IN ('in', 'out')),
  status VARCHAR(20) CHECK (status IN ('approved', 'denied')),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  distance_meters DOUBLE PRECISION,
  radius_meters INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast queries by user, branch, and date
CREATE INDEX IF NOT EXISTS idx_attendance_logs_user_id ON attendance_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_branch_id ON attendance_logs(branch_id);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_created_at ON attendance_logs(created_at DESC);

-- 5. Enable Row Level Security (RLS) on attendance_logs
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;

-- Allow all operations for public/anon users (matches the existing app model for direct anon query)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'attendance_logs' AND policyname = 'Allow all on attendance_logs'
  ) THEN
    CREATE POLICY "Allow all on attendance_logs" ON attendance_logs
      FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
