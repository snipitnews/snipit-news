-- Check if the trigger and function exist
SELECT 
    t.trigger_name,
    t.event_manipulation,
    t.action_timing,
    t.action_statement
FROM information_schema.triggers t
WHERE t.trigger_name = 'on_auth_user_created';

-- Check if the function exists
SELECT 
    r.routine_name,
    r.routine_type,
    r.data_type
FROM information_schema.routines r
WHERE r.routine_name = 'handle_new_user';

-- Check RLS policies on users table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename = 'users';

-- Check if RLS is enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'users';
