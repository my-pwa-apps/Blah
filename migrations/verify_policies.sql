-- Check if there are any recursive policies on participants table
SELECT 
    tablename, 
    policyname, 
    permissive, 
    using_expr 
FROM 
    pg_policies 
WHERE 
    tablename = 'participants';

-- Check if clean_sensitive_data function exists
SELECT 
    proname, 
    proowner::regrole::text 
FROM 
    pg_proc 
WHERE 
    proname = 'clean_sensitive_data';

-- Check if participants policies are properly set
SELECT 
    tablename, 
    policyname 
FROM 
    pg_policies 
WHERE 
    tablename = 'participants';
