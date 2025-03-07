-- Add last_read_at column to participants table
ALTER TABLE participants ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMP WITH TIME ZONE;
