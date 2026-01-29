-- URGENT REVERT FIX: Handle dependencies correctly
-- This will FORCE remove the function and all policies linked to it.

-- 1. Drop the policies depending on the function FIRST or use CASCADE
-- We use CASCADE on the function drop to automatically remove any policies depending on it
-- This is the "Nuclear Option" to ensure it works this time.
DROP FUNCTION IF EXISTS public.is_manager() CASCADE;

-- Just in case, clean up any specific policies if they weren't caught
DROP POLICY IF EXISTS "Managers can view all profiles security fix" ON public.user_profiles;
DROP POLICY IF EXISTS "Technicians view own, Managers view all" ON public.procedure_suggestions;

-- 2. Restore the Metadata-based Policy for Profiles (The one that worked this morning)
CREATE POLICY "Managers can view all profiles (Metadata Fallback)"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = id
  OR
  -- This checks the Auth Token directly
  (auth.jwt() -> 'user_metadata' ->> 'role' ILIKE 'manager')
);

-- 3. Restore the Permissive Policy for Suggestions
CREATE POLICY "Enable read access for all authenticated users"
ON public.procedure_suggestions
FOR SELECT
TO authenticated
USING (true);
