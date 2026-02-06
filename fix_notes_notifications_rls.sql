-- FIX: Standardize and broaden RLS for notes table to support the notification system

-- 1. SELECT Policy: Allow Managers to see all suggestions and notification records from any user
-- Also ensure Technicians can see their own personal notes and public notes.

DROP POLICY IF EXISTS "Users can read own notes, managers can read all" ON public.notes;
DROP POLICY IF EXISTS "Users can view their own notes OR public notes" ON public.notes;
DROP POLICY IF EXISTS "Notes select policy" ON public.notes;

CREATE POLICY "Notes select policy" 
ON public.notes FOR SELECT 
TO authenticated
USING (
  -- 1. Own notes or notifications sent to self
  auth.uid() = user_id 
  OR 
  -- 2. Published Flash Notes
  status = 'public'
  OR
  -- 3. Managers can see all Flash-related items (suggestions/notifications)
  (
    (auth.jwt() -> 'user_metadata' ->> 'role' ILIKE 'manager')
    AND
    (status = 'suggestion' OR is_flash_note = true OR title ILIKE 'FLASH_NOTE_%')
  )
);

-- 2. INSERT Policy: Allow Managers to create notifications for other users
-- Technicians can still create their own notes.

DROP POLICY IF EXISTS "Authenticated users can insert own notes" ON public.notes;
DROP POLICY IF EXISTS "Notes insert policy" ON public.notes;

CREATE POLICY "Notes insert policy" 
ON public.notes FOR INSERT 
TO authenticated
WITH CHECK (
  -- 1. Create own notes
  auth.uid() = user_id 
  OR 
  -- 2. Managers can create notification records for others
  (
    (auth.jwt() -> 'user_metadata' ->> 'role' ILIKE 'manager')
    AND
    (title ILIKE 'FLASH_NOTE_%')
  )
);

-- 3. UPDATE/DELETE Policies (Keep existing ownership logic, but grant Manager visibility)
-- (Existing policies usually allow Managers to update 'viewed' status, which is fine)
