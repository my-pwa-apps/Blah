-- Ensure the storage schema is accessible to authenticated users

-- Grant usage on storage schema
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT USAGE ON SCHEMA storage TO anon;

-- Grant additional necessary permissions to buckets and objects tables
GRANT SELECT ON storage.buckets TO authenticated;
GRANT SELECT ON storage.buckets TO anon;

-- Create a helper function to fix permissions
CREATE OR REPLACE FUNCTION public.grant_bucket_access(bucket_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Ensure the bucket exists
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = bucket_name) THEN
    RAISE EXCEPTION 'Bucket % does not exist', bucket_name;
  END IF;

  -- Grant permissions to authenticated role for bucket operations
  EXECUTE format('GRANT SELECT, INSERT ON storage.objects TO authenticated');
  EXECUTE format('GRANT SELECT ON storage.buckets TO authenticated');
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error fixing permissions: %', SQLERRM;
    RETURN FALSE;
END;
$$;
