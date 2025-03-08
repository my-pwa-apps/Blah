-- Enable the storage extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create the attachments bucket
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('attachments', 'attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Set up security policies for the attachments bucket
-- Allow authenticated users to read all objects
CREATE POLICY "Authenticated users can read attachments" 
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'attachments' AND 
    auth.role() = 'authenticated'
  );

-- Allow users to upload their own files (under their user ID path)
CREATE POLICY "Users can upload their own attachments" 
  ON storage.objects FOR INSERT 
  WITH CHECK (
    bucket_id = 'attachments' AND
    auth.uid()::text = (storage.foldername(name))[1] AND
    auth.role() = 'authenticated'
  );

-- Allow users to update and delete only their own files
CREATE POLICY "Users can update their own attachments" 
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'attachments' AND
    auth.uid()::text = (storage.foldername(name))[1] AND
    auth.role() = 'authenticated'
  );

CREATE POLICY "Users can delete their own attachments" 
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'attachments' AND
    auth.uid()::text = (storage.foldername(name))[1] AND
    auth.role() = 'authenticated'
  );
