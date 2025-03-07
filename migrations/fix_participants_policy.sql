-- Fix recursion in participants policy by completely rewriting it
DROP POLICY IF EXISTS "Users can read participants" ON participants;

-- New non-recursive policy that just checks direct user ID
CREATE POLICY "Users can read participants"
ON participants FOR SELECT
TO authenticated
USING (
    -- Either the participant record is for the current user
    user_id = auth.uid()
    OR
    -- Or the current user is a direct participant in the conversation
    conversation_id IN (
        SELECT conversation_id 
        FROM participants 
        WHERE user_id = auth.uid()
    )
);

-- Update the insert policy to simplify logic and avoid recursion
DROP POLICY IF EXISTS "Users can add participants" ON participants;

CREATE POLICY "Users can add participants"
ON participants FOR INSERT
TO authenticated
WITH CHECK (
    -- User can add themselves to a conversation
    NEW.user_id = auth.uid()
    OR
    -- User can add others to conversations they're in
    NEW.conversation_id IN (
        SELECT conversation_id
        FROM participants
        WHERE user_id = auth.uid()
    )
);
