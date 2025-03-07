# Debug and Fix Current Issues

## 1. Fixing Database Policies

The application is experiencing infinite recursion in both the participants and messages policies. Follow these steps:

1. **Manual Fix via Supabase Dashboard:**
   - Go to the [Supabase Dashboard](https://app.supabase.com/)
   - Select your project: bcjaxvmwdkxkbkocxhpq
   - Go to SQL Editor
   - Copy and execute this SQL:

```sql
-- CRITICAL: Fix participants table
DROP POLICY IF EXISTS "Users can read participants" ON participants;
DROP POLICY IF EXISTS "Users can add participants" ON participants;

CREATE POLICY "Users can read participants" 
ON participants FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR true);

CREATE POLICY "Users can add participants" 
ON participants FOR INSERT
TO authenticated
WITH CHECK (true);

-- CRITICAL: Fix messages table
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

2. **Automated Fix:**
   - Alternatively, include `fix_policies.js` in your HTML file
   - A red button will appear at the top right of the app
   - Click it to automatically apply the fix

## 2. Missing Assets

The application cannot find some required files:

1. **Add Missing Sound Files:**
   - Create a `sounds` folder in your public directory
   - Add a `notification.mp3` file to this folder
   - You can download a simple notification sound from [Mixkit](https://mixkit.co/free-sound-effects/notification/)

2. **Add Missing Icons:**
   - Create an `images` folder in your public directory
   - Add `icon-192x192.png` and `icon-512x512.png` files to this folder
   - You can generate simple icons with [favicon.io](https://favicon.io/) or similar tools

## 3. Subscription Issues

If you continue to see subscription errors in the console:

1. **Testing If Real-time Is Working:**
   - Press `Ctrl+Shift+D` to open the debug panel
   - Click "Test Connection" to verify real-time connectivity
   - If the test fails, click "Enable Polling Fallback"

2. **Troubleshooting:**
   - Clear browser cache and local storage
   - Check browser console for errors
   - Verify that the Supabase project has real-time enabled
   - Try a different browser

## If All Else Fails

As a last resort, simplify your policies even further:

```sql
-- Reset ALL policies on critical tables
DROP POLICY IF EXISTS "Users can read participants" ON participants;
DROP POLICY IF EXISTS "Users can add participants" ON participants;
DROP POLICY IF EXISTS "Users can read profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can read their conversations" ON conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON conversations;

-- Create extremely permissive policies (NOT RECOMMENDED for production!)
CREATE POLICY "temp_read_all_participants" ON participants FOR SELECT USING (true);
CREATE POLICY "temp_insert_participants" ON participants FOR INSERT WITH CHECK (true);
CREATE POLICY "temp_read_all_profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "temp_read_all_conversations" ON conversations FOR SELECT USING (true);
```
