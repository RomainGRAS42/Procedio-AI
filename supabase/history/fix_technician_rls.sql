-- FIX: Allow all authenticated users to read profiles
-- This resolves the "Timeout" error for Technicians in App.tsx
-- AND ensures they can see Manager names in suggestions.

-- 1. Enable RLS (just in case)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing restrictive policies
DROP POLICY IF EXISTS "Enable read access for all users" ON public.user_profiles;
DROP POLICY IF EXISTS "Managers can view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;

-- 3. Create a PERMISSIVE read policy for authenticated users
-- "Authenticated users can see any profile"
DROP POLICY IF EXISTS "Allow read access for all authenticated users" ON public.user_profiles;

CREATE POLICY "Allow read access for all authenticated users"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (true);

-- 4. INSERT/UPDATE policies (keep strict)
-- Users can only edit THEIR OWN profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;

CREATE POLICY "Users can update own profile"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Users can insert THEIR OWN profile
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;

CREATE POLICY "Users can insert own profile"
ON public.user_profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);
