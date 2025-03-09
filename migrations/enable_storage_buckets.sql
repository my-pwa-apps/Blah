-- This script must be run by a Supabase administrator in the SQL Editor
-- Due to RLS policies, regular users cannot create buckets

-- Check if the storage extension is enabled
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_net'
  ) THEN
    RAISE NOTICE 'Storage extension is not enabled. Enabling now...';
    CREATE EXTENSION IF NOT EXISTS "pg_net";
  END IF;
END
$$;

-- Create the attachments bucket
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('attachments', 'attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Authenticated users can read attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own attachments" ON storage.objects;

-- Set up security policies for the attachments bucket
-- Allow authenticated users to read all objects
CREATE POLICY "Authenticated users can read attachments" 
  ON storage.objects FOR SELECT
  USING (bucket_id = 'attachments' AND auth.role() = 'authenticated');

-- Allow users to upload their own files (under their user ID path)
CREATE POLICY "Users can upload their own attachments" 
  ON storage.objects FOR INSERT 
  WITH CHECK (
    bucket_id = 'attachments' AND
    auth.uid()::text = (storage.foldername(name))[1] AND
    auth.role() = 'authenticated'
  );

-- Allow users to update only their own files
CREATE POLICY "Users can update their own attachments" 
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'attachments' AND
    auth.uid()::text = (storage.foldername(name))[1] AND
    auth.role() = 'authenticated'
  );

-- Allow users to delete only their own files
CREATE POLICY "Users can delete their own attachments" 
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'attachments' AND
    auth.uid()::text = (storage.foldername(name))[1] AND
    auth.role() = 'authenticated'
  );

-- Verify the bucket exists
DO $$
DECLARE
  bucket_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'attachments'
  ) INTO bucket_exists;
  
  IF bucket_exists THEN
    RAISE NOTICE 'Storage bucket "attachments" is properly configured';
  ELSE
    RAISE EXCEPTION 'Failed to create storage bucket "attachments"';
  END IF;
END
$$;
