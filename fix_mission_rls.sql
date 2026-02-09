-- Enable RLS on missions table if not already enabled
ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;

-- 1. VIEW POLICY: Everyone can view missions assigned to them or created by them
-- Managers can view ALL missions (if they need oversight)
DROP POLICY IF EXISTS "Users can view their own missions" ON public.missions;
CREATE POLICY "Users can view their own missions"
ON public.missions
FOR SELECT
TO authenticated
USING (
  auth.uid() = assigned_to OR 
  auth.uid() = created_by OR
  status = 'open' OR -- Everyone can see open missions to claim them
  (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'MANAGER'
);

-- 2. INSERT POLICY: Only Managers (and potentially Technicians?) can create missions
DROP POLICY IF EXISTS "Users can create missions" ON public.missions;
CREATE POLICY "Users can create missions"
ON public.missions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by
);

-- 3. UPDATE POLICY: Crucial for "Start" / "Complete"
-- Assignees must be able to update status
DROP POLICY IF EXISTS "Users can update their missions" ON public.missions;
CREATE POLICY "Users can update their missions"
ON public.missions
FOR UPDATE
TO authenticated
USING (
  auth.uid() = assigned_to OR 
  auth.uid() = created_by OR
  (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'MANAGER'
)
WITH CHECK (
  auth.uid() = assigned_to OR 
  auth.uid() = created_by OR
  (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'MANAGER'
);

-- 4. DELETE POLICY: Only Creator or Manager
DROP POLICY IF EXISTS "Users can delete their missions" ON public.missions;
CREATE POLICY "Users can delete their missions"
ON public.missions
FOR DELETE
TO authenticated
USING (
  auth.uid() = created_by OR
  (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'MANAGER'
);
