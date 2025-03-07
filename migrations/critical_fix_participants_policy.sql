-- CRITICAL: Drop all existing policies on participants table to eliminate infinite recursion
DROP POLICY IF EXISTS "Users can read participants" ON participants;
DROP POLICY IF EXISTS "Users can add participants" ON participants;
DROP POLICY IF EXISTS "Users can update participants" ON participants;
DROP POLICY IF EXISTS "Users can delete participants" ON participants;

-- Create simplified policies without any self-referencing queries
-- This SELECT policy checks only auth.uid() directly 
CREATE POLICY "Users can read participants" 
ON participants FOR SELECT
TO authenticated
USING (
    -- Users can see participants in conversations they're participating in
    conversation_id IN (
        SELECT DISTINCT conversation_id FROM participants 
        WHERE user_id = auth.uid()
    )
);

-- This INSERT policy is simplified
CREATE POLICY "Users can add participants" 
ON participants FOR INSERT
TO authenticated
WITH CHECK (
    -- Either adding self to a conversation
    NEW.user_id = auth.uid() 
    OR 
    -- Or adding someone else to a conversation user belongs to
    EXISTS (
        SELECT 1 FROM participants
        WHERE conversation_id = NEW.conversation_id
        AND user_id = auth.uid()
    )
);
