-- Drop existing publication if it exists
DROP PUBLICATION IF EXISTS supabase_realtime;

-- Create new publication with explicit table
CREATE PUBLICATION supabase_realtime FOR TABLE messages;

-- Enable row level security
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Update RLS policies
DROP POLICY IF EXISTS "Enable read access for participants" ON messages;
DROP POLICY IF EXISTS "Enable insert access for participants" ON messages;

CREATE POLICY "Enable read access for participants"
ON messages FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM participants
        WHERE participants.conversation_id = messages.conversation_id
        AND participants.user_id = auth.uid()
    )
);

CREATE POLICY "Enable insert access for participants"
ON messages FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM participants
        WHERE participants.conversation_id = conversation_id
        AND participants.user_id = auth.uid()
    )
);

-- Ensure proper indexes
CREATE INDEX IF NOT EXISTS idx_messages_conversation_realtime 
ON messages(conversation_id, created_at);
