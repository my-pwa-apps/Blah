-- Add JSONB metadata column to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Add index for better query performance when filtering on metadata
CREATE INDEX IF NOT EXISTS idx_messages_metadata ON messages USING GIN (metadata);

-- Update RLS policies to allow metadata
DROP POLICY IF EXISTS "temp_messages_insert" ON messages;
CREATE POLICY "temp_messages_insert"
ON messages FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Grant proper permissions
GRANT ALL ON messages TO authenticated;
GRANT ALL ON messages TO anon;

-- Verify real-time is configured for all columns
ALTER PUBLICATION supabase_realtime SET ( publish_via_partition_root = true );
