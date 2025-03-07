-- EMERGENCY FIX: Drop and recreate all policies to eliminate infinite recursion
-- First, drop all existing policies on participants table
DROP POLICY IF EXISTS "Users can read participants" ON participants;
DROP POLICY IF EXISTS "Users can add participants" ON participants;
DROP POLICY IF EXISTS "Users can update participants" ON participants;
DROP POLICY IF EXISTS "Users can delete participants" ON participants;

-- Create extremely simple policies with no recursion or complex logic
-- This is a temporary fix to get the application working
-- These should be replaced with proper policies later
CREATE POLICY "temp_all_select_participants" 
ON participants FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "temp_all_insert_participants" 
ON participants FOR INSERT
TO authenticated
WITH CHECK (true);

-- Also fix profile policies which might be causing issues
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
