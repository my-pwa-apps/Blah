-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Profile policies
DROP POLICY IF EXISTS "Users can read profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Users can read profiles"
ON profiles FOR SELECT
TO authenticated
USING (
    -- Can read profiles of users they share conversations with
    EXISTS (
        SELECT 1 FROM participants p1
        JOIN participants p2 ON p1.conversation_id = p2.conversation_id
        WHERE p1.user_id = auth.uid()
        AND p2.user_id = profiles.id
    )
    OR id = auth.uid() -- Can always read own profile
);

CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Conversation policies
DROP POLICY IF EXISTS "Users can read their conversations" ON conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON conversations;

CREATE POLICY "Users can read their conversations"
ON conversations FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM participants
        WHERE conversation_id = id
        AND user_id = auth.uid()
    )
);

CREATE POLICY "Users can create conversations"
ON conversations FOR INSERT
TO authenticated
WITH CHECK (true); -- Additional checks handled in participants table

-- Participant policies
DROP POLICY IF EXISTS "Users can read participants" ON participants;
DROP POLICY IF EXISTS "Users can add participants" ON participants;

CREATE POLICY "Users can read participants"
ON participants FOR SELECT
TO authenticated
USING (
    user_id = auth.uid() OR  -- Can read own participant entries
    conversation_id IN (     -- Can read participants of conversations they're in
        SELECT p.conversation_id 
        FROM participants p 
        WHERE p.user_id = auth.uid()
    )
);

CREATE POLICY "Users can add participants"
ON participants FOR INSERT
TO authenticated
WITH CHECK (
    -- Only allow adding participants if user is already a participant or creating new conversation
    NEW.user_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM participants p
        WHERE p.conversation_id = NEW.conversation_id
        AND p.user_id = auth.uid()
    )
);

-- Message policies with rate limiting
DROP POLICY IF EXISTS "Users can read messages" ON messages;
DROP POLICY IF EXISTS "Users can send messages" ON messages;

CREATE POLICY "Users can read messages"
ON messages FOR SELECT
TO authenticated
USING (
    conversation_id IN (
        SELECT conversation_id FROM participants
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can send messages"
ON messages FOR INSERT
TO authenticated
WITH CHECK (
    -- Must be a participant
    EXISTS (
        SELECT 1 FROM participants
        WHERE conversation_id = NEW.conversation_id
        AND user_id = auth.uid()
    )
    -- Rate limiting: max 10 messages per minute per user
    AND (
        SELECT COUNT(*)
        FROM messages
        WHERE sender_id = auth.uid()
        AND created_at > NOW() - INTERVAL '1 minute'
    ) < 10
);

-- Add database constraints for input validation
ALTER TABLE messages
    ADD CONSTRAINT message_length_check 
    CHECK (length(content) BETWEEN 1 AND 2000);

ALTER TABLE profiles
    ADD CONSTRAINT display_name_length_check 
    CHECK (length(display_name) BETWEEN 1 AND 50),
    ADD CONSTRAINT email_format_check 
    CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Add indexes for performance and security
CREATE INDEX IF NOT EXISTS idx_messages_rate_limit 
ON messages (sender_id, created_at);

CREATE INDEX IF NOT EXISTS idx_participants_user_conversation 
ON participants (user_id, conversation_id);

-- Function to clean sensitive data
CREATE OR REPLACE FUNCTION clean_sensitive_data() RETURNS trigger AS $$
BEGIN
    NEW.content := regexp_replace(NEW.content, '\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}', '[REDACTED]'); -- Credit card
    NEW.content := regexp_replace(NEW.content, '\b[\w\.-]+@[\w\.-]+\.\w{2,4}\b', '[REDACTED]'); -- Email
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to clean sensitive data before insert
CREATE TRIGGER clean_message_content
    BEFORE INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION clean_sensitive_data();
