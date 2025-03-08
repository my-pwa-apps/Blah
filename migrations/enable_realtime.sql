-- Enable real-time for the messages table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Ensure proper RLS policies for real-time
CREATE POLICY "Enable read access for authenticated users" 
ON messages FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM participants p 
    WHERE p.conversation_id = messages.conversation_id 
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Enable insert access for participants" 
ON messages FOR INSERT 
TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM participants p 
    WHERE p.conversation_id = messages.conversation_id 
    AND p.user_id = auth.uid()
  )
);
