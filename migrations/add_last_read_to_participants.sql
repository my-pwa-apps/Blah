-- Add last_read_at column to participants table if it doesn't exist
ALTER TABLE participants ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMP WITH TIME ZONE;

-- Ensure is_self_chat column exists in conversations table
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_self_chat BOOLEAN DEFAULT FALSE;

-- Add index to improve query performance
CREATE INDEX IF NOT EXISTS idx_participants_user_id ON participants(user_id);
CREATE INDEX IF NOT EXISTS idx_participants_conversation_id ON participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
