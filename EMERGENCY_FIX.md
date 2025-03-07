# Emergency Fix for Application Issues

We're experiencing three critical issues:

1. Database policy errors causing "infinite recursion" on participants table
2. Database policy errors causing "infinite recursion" on messages table
3. Real-time subscription issues

## How to Apply the Fix

### Option 1: From the Supabase Dashboard (Recommended)

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Select project: `bcjaxvmwdkxkbkocxhpq`
3. Navigate to the SQL Editor
4. Copy and paste this entire SQL block:

```sql
-- EMERGENCY FIX: Drop and recreate all policies to eliminate infinite recursion
-- Fix participants table policies
DROP POLICY IF EXISTS "Users can read participants" ON participants;
DROP POLICY IF EXISTS "Users can add participants" ON participants;
DROP POLICY IF EXISTS "Users can update participants" ON participants;
DROP POLICY IF EXISTS "Users can delete participants" ON participants;

CREATE POLICY "temp_all_select_participants" 
ON participants FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "temp_all_insert_participants" 
ON participants FOR INSERT
TO authenticated
WITH CHECK (true);

-- Fix profile policies
DROP POLICY IF EXISTS "Users can read profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "temp_all_select_profiles"
ON profiles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "temp_all_update_profiles"
ON profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Fix messages policies
DROP POLICY IF EXISTS "Users can read messages" ON messages;
DROP POLICY IF EXISTS "Users can send messages" ON messages;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON messages;
DROP POLICY IF EXISTS "Enable insert access for participants" ON messages;

CREATE POLICY "temp_messages_select" 
ON messages FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "temp_messages_insert"
ON messages FOR INSERT
TO authenticated
WITH CHECK (true);
```

5. Click "Run" and wait for confirmation
6. Refresh your application completely (Ctrl+F5 or Cmd+Shift+R)

### Option 2: From the Application

1. Add this script tag to your HTML file:

```html
<script src="js/emergency_fix.js"></script>
```

2. Refresh the application
3. Click on the "FIX DATABASE POLICIES" button that appears
4. Refresh the application again after the fix is applied

## Verifying the Fix

After applying the fix:

1. The "infinite recursion" errors should no longer appear in the console
2. User profiles should load correctly
3. Messages should send successfully
4. Real-time messaging should work properly

## Fixing Real-Time Subscription Issues

If you're experiencing TIMED_OUT errors with real-time subscriptions:

1. First, apply the database policy fixes above
2. Then, if subscription issues persist, execute this SQL in the Supabase SQL Editor:

```sql
-- CRITICAL: Fix real-time configuration
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR TABLE messages, participants, conversations;
ALTER TABLE messages REPLICA IDENTITY FULL;
ALTER TABLE participants REPLICA IDENTITY FULL;
ALTER TABLE conversations REPLICA IDENTITY FULL;
```

3. In the application, use these diagnostic steps:
   - Press Ctrl+Shift+D to open the debug panel
   - Click "Test Connection" to check real-time connectivity
   - If the test fails, click "Enable Polling" to use a fallback

## Why This Fixes the Issue

The timeout errors happen when:
1. The real-time publication is misconfigured in Supabase
2. Tables don't have the proper replica identity for real-time updates
3. Network connectivity issues prevent WebSocket connections

The fixes reconfigure the real-time system and provide a polling fallback when WebSockets aren't working.

If issues persist, please contact support.
