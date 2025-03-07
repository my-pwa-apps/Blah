-- Fix real-time subscription issues by properly configuring the publication
-- First, drop the existing publication if it exists
DROP PUBLICATION IF EXISTS supabase_realtime;

-- Recreate the publication with the correct tables
CREATE PUBLICATION supabase_realtime FOR TABLE messages, participants, conversations;

-- Make sure the replication identities are set correctly for real-time
ALTER TABLE messages REPLICA IDENTITY FULL;
ALTER TABLE participants REPLICA IDENTITY FULL;
ALTER TABLE conversations REPLICA IDENTITY FULL;

-- Enable real-time events for our tables
BEGIN;
  -- Enable the pg_stat_statements extension needed for real-time
  CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
  
  -- Set the publication to include all operations (insert, update, delete, truncate)
  ALTER PUBLICATION supabase_realtime SET (publish = 'insert, update, delete, truncate');
COMMIT;

-- Refresh the replication slots (only needed in some cases)
SELECT pg_reload_conf();
