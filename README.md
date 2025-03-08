# Message App

## Storage Setup for Administrators

The app requires proper configuration of Supabase storage to handle file attachments. **These steps must be performed by a Supabase administrator**.

### Option 1: Run the Migration Script (Recommended)

1. Login to your Supabase dashboard
2. Navigate to the SQL Editor
3. Copy and paste the content from `migrations/enable_storage_buckets.sql`
4. Run the script
5. Verify in the Storage section that an "attachments" bucket has been created

### Option 2: Manual Configuration

If you prefer to set up storage manually:

1. Log into your Supabase dashboard
2. Navigate to "Storage"
3. Click "Create a new bucket"
4. Name it "attachments" 
5. Check "Public bucket" to enable public access
6. Click "Create bucket"

After creating the bucket, you'll need to set up the following bucket policies:

#### SELECT policy (view files):
- Name: "Authenticated users can read attachments"
- Policy definition: `bucket_id = 'attachments' AND auth.role() = 'authenticated'`

#### INSERT policy (upload files):
- Name: "Users can upload their own attachments"
- Policy definition: `bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1] AND auth.role() = 'authenticated'`

#### UPDATE policy (modify files):
- Name: "Users can update their own attachments"
- Policy definition: `bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1] AND auth.role() = 'authenticated'`

#### DELETE policy (remove files):
- Name: "Users can delete their own attachments"
- Policy definition: `bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1] AND auth.role() = 'authenticated'`

## Troubleshooting

### Storage Not Configured Error
If users get "Storage not configured" errors when uploading attachments, it means the storage bucket setup has not been completed. An administrator should follow the steps above.

### Permission Denied Errors
If users get "Permission denied" errors when uploading, the storage policies may not be configured correctly. Double check that the policies match exactly as specified above.

### Row-Level Security Errors
If you see "row-level security policy" errors when running the setup, make sure you're logged in as a Supabase administrator with full access rights.
