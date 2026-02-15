-- RE-FIX: Use join with user_profiles instead of JWT metadata for more reliable role-based RLS

-- 1. DROP previous policies
DROP POLICY IF EXISTS "Notes select policy" ON public.notes;
DROP POLICY IF EXISTS "Notes insert policy" ON public.notes;

-- 2. CREATE revised SELECT policy
-- Techs: Own notes + Notifications to self + Public Flash Notes
-- Managers: Everything above + Any Suggestion or Notification record
CREATE POLICY "Notes select policy" 
ON public.notes FOR SELECT 
TO authenticated
USING (
  -- L'utilisateur est propriétaire ou c'est une note publique
  auth.uid() = user_id 
  OR 
  status = 'public'
  OR 
  -- OU c'est un Manager (vérifié via la table user_profiles)
  (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND (role = 'manager' OR role = 'MANAGER')
    )
    AND
    (status = 'suggestion' OR is_flash_note = true OR title ILIKE 'FLASH_NOTE_%')
  )
);

-- 3. CREATE revised INSERT policy
-- Techs: Can create own notes/suggestions
-- Managers: Can create notifications for others
CREATE POLICY "Notes insert policy" 
ON public.notes FOR INSERT 
TO authenticated
WITH CHECK (
  -- Création de ses propres notes
  auth.uid() = user_id 
  OR 
  -- Autoriser les Managers à créer des notifications (titre spécifique) pour d'autres
  (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND (role = 'manager' OR role = 'MANAGER')
    )
    AND
    (title ILIKE 'FLASH_NOTE_%')
  )
);

-- Note: Les politiques d'UPDATE et DELETE restent basées sur la propriété user_id (auth.uid() = user_id)
-- Les Managers peuvent déjà UPDATE le statut via une politique séparée (status = 'public').
