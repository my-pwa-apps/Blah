# Message App

## Storage Setup

Before using the app, you need to create a storage bucket in Supabase:

1. Log into your Supabase dashboard
2. Navigate to "Storage"
3. Click "Create a new bucket"
4. Name it "attachments" 
5. Check "Public bucket" to enable public access
6. Click "Create bucket"

After creating the bucket, you'll need to set up the following bucket policies:

### SELECT policy (view files):
- Name: "Authenticated users can read attachments"
- Policy definition: `bucket_id = 'attachments' AND auth.role() = 'authenticated'`

### INSERT policy (upload files):
- Name: "Users can upload their own attachments"
- Policy definition: `bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1] AND auth.role() = 'authenticated'`

### UPDATE policy:
- Name: "Users can update their own attachments"
- Policy definition: `bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1] AND auth.role() = 'authenticated'`

### DELETE policy:
- Name: "Users can delete their own attachments"
- Policy definition: `bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1] AND auth.role() = 'authenticated'`

## Alternative Setup

Instead of manual configuration, you can run the SQL migration script:

```sql
-- Run this in Supabase SQL Editor
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Set up basic policies
CREATE POLICY "Authenticated users can read attachments" 
  ON storage.objects FOR SELECT
  USING (bucket_id = 'attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Users can upload their own attachments" 
  ON storage.objects FOR INSERT 
  WITH CHECK (bucket_id = 'attachments' AND 
              auth.uid()::text = (storage.foldername(name))[1]);
```
