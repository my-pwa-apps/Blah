# Emergency Fix for Application Issues

We're experiencing two critical issues:

1. Database policy errors causing "infinite recursion"
2. Real-time subscription issues

## How to Apply the Fix

### Option 1: From the Supabase Dashboard (Recommended)

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Select project: `bcjaxvmwdkxkbkocxhpq`
3. Navigate to the SQL Editor
4. Copy and paste this entire SQL block:

```sql
-- EMERGENCY FIX: Drop and recreate all policies to eliminate infinite recursion
-- Drop all existing policies on participants table
DROP POLICY IF EXISTS "Users can read participants" ON participants;
DROP POLICY IF EXISTS "Users can add participants" ON participants;
DROP POLICY IF EXISTS "Users can update participants" ON participants;
DROP POLICY IF EXISTS "Users can delete participants" ON participants;

-- Create extremely simple policies with no recursion or complex logic
CREATE POLICY "temp_all_select_participants" 
ON participants FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "temp_all_insert_participants" 
ON participants FOR INSERT
TO authenticated
WITH CHECK (true);

-- Also fix profile policies
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
3. Real-time messaging should work properly

If issues persist, please contact support.
