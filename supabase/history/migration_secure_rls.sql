-- SECURITY FIX: Replace insecure user_metadata check with secure DB lookup
-- This fixes the "RLS references user metadata" warning from Supabase Security Advisor

-- 1. Create a secure function to check manager role
-- SECURITY DEFINER ensures this function runs with admin privileges, bypassing RLS to avoid recursion
CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid()
    AND role = 'MANAGER'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop the old insecure policy
DROP POLICY IF EXISTS "Managers can view all profiles" ON public.user_profiles;

-- 3. Create the new secure policy
-- Managers can view all profiles (via secure function), Users can view their own
CREATE POLICY "Managers can view all profiles security fix"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = id
  OR
  public.is_manager()
);

-- 4. Verify Policy for Suggestions (Update if needed to use the same secure check)
-- Dropping potentially duplicate policies just in case
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON procedure_suggestions;

-- Re-applying with stricter role check for Managers vs just "authenticated"
-- Technicians can see their own suggestions
-- Managers can see ALL suggestions
CREATE POLICY "Technicians view own, Managers view all"
ON procedure_suggestions
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR
  public.is_manager()
);
