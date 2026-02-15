-- ULTIMATE FIX: Comprehensive RLS for Note Notifications (v3)
-- Covers SELECT, INSERT, and DELETE for both Technicians and Managers

-- 1. DROP previous attempts
DROP POLICY IF EXISTS "Notes select policy" ON public.notes;
DROP POLICY IF EXISTS "Notes insert policy" ON public.notes;
DROP POLICY IF EXISTS "Managers can delete notifications" ON public.notes;

-- 2. SELECT: Allow viewing own notes, public notes, and system notifications
CREATE POLICY "Notes select policy" 
ON public.notes FOR SELECT 
TO authenticated
USING (
  -- L'utilisateur est propriétaire ou c'est une note publique
  auth.uid() = user_id 
  OR 
  status = 'public'
  OR 
  -- OU c'est un Manager
  (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND (role = 'manager' OR role = 'MANAGER')
    )
    AND
    (status = 'suggestion' OR is_flash_note = true OR title ILIKE 'FLASH_NOTE_%')
  )
);

-- 3. INSERT: Allow Managers to send notifications to others
CREATE POLICY "Notes insert policy" 
ON public.notes FOR INSERT 
TO authenticated
WITH CHECK (
  auth.uid() = user_id 
  OR 
  (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND (role = 'manager' OR role = 'MANAGER')
    )
    AND
    (title ILIKE 'FLASH_NOTE_%')
  )
);

-- 4. DELETE: Allow Managers and Techs to clear notifications (mark as read)
CREATE POLICY "Notes delete policy" 
ON public.notes FOR DELETE 
TO authenticated
USING (
  -- Propriétaire de la note
  auth.uid() = user_id
  OR
  -- Ou Manager qui supprime un signalement/notification
  (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND (role = 'manager' OR role = 'MANAGER')
    )
    AND
    (title ILIKE 'FLASH_NOTE_%' OR status = 'suggestion')
  )
);

-- 5. Force update of existing records status to ensure visibility
UPDATE public.notes 
SET is_flash_note = true 
WHERE status = 'suggestion' AND is_flash_note = false;
