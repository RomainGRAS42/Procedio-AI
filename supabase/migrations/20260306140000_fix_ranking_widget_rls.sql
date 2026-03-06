-- Fix RLS for Ranking Widget visibility
-- Allow authenticated users (Managers) to view all user badges
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view all user badges" ON public.user_badges;

CREATE POLICY "Authenticated users can view all user badges"
ON public.user_badges FOR SELECT
TO authenticated
USING (true);

-- Ensure user_profiles is also visible (redundant but safe)
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.user_profiles;

CREATE POLICY "Authenticated users can view all profiles"
ON public.user_profiles FOR SELECT
TO authenticated
USING (true);
