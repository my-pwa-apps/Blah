-- Make sure is_self_chat is correctly set for all existing conversations
UPDATE conversations c
SET is_self_chat = true 
WHERE (
  SELECT COUNT(DISTINCT p.user_id)
  FROM participants p
  WHERE p.conversation_id = c.id
) = 1;

-- Make sure is_self_chat is false for conversations with multiple participants
UPDATE conversations c
SET is_self_chat = false
WHERE (
  SELECT COUNT(DISTINCT p.user_id)
  FROM participants p
  WHERE p.conversation_id = c.id
) > 1;

-- Ensure the last_read_at column exists and is properly indexed
ALTER TABLE participants ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMP WITH TIME ZONE;
CREATE INDEX IF NOT EXISTS idx_participants_last_read ON participants(last_read_at);
