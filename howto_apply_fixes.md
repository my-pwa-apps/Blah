# How to Apply Critical Fixes

## 1. Fix Participants Policy Infinite Recursion

The application is experiencing a critical error with the participants policy causing infinite recursion. This needs to be fixed at the database level.

### Steps:

1. Go to your Supabase dashboard: https://app.supabase.com/
2. Navigate to your project: bcjaxvmwdkxkbkocxhpq
3. Open the SQL editor
4. Copy and paste the SQL from `migrations/critical_fix_participants_policy.sql`
5. Run the SQL query
6. Verify success by checking the policies on the participants table

## 2. Fix Real-Time Subscription Issues

The application code has been updated to handle subscription errors better. After applying the database fix above:

1. Make sure all code changes in `DataModule.js` and `UIModule.js` are applied
2. Clear your browser cache completely
3. Restart the application

## 3. Testing the Fixes

After applying both fixes:
1. Try logging in again - the infinite recursion error should be gone
2. Test real-time messaging - it should reconnect automatically if there are issues
3. Check the browser console for any remaining errors

If problems persist, try enabling the debug panel by pressing Ctrl+Shift+D while in the application to see real-time connection status.
