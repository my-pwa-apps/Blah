-- Add indexes to improve query performance for real-time updates

-- Index for faster participant lookups by user_id
CREATE INDEX IF NOT EXISTS idx_participants_user_id ON participants(user_id);

-- Index for faster participant lookups by conversation_id
CREATE INDEX IF NOT EXISTS idx_participants_conversation_id ON participants(conversation_id);

-- Index for faster message lookups by conversation_id
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);

-- Index for faster message lookups by sender_id
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);

-- Index for last_read_at to speed up unread checks
CREATE INDEX IF NOT EXISTS idx_participants_last_read_at ON participants(last_read_at);
