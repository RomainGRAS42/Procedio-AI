-- Autoriser les Managers à voir TOUS les profils (pour le panneau d'administration)
-- Actuellement, vous ne voyez probablement que votre propre profil à cause de la sécurité par défaut.

CREATE POLICY "Managers can view all profiles"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (
  -- L'utilisateur est autorisé SI :
  -- 1. C'est son propre profil (toujours vrai)
  (auth.uid() = id)
  OR
  -- 2. OU SI l'utilisateur connecté est un MANAGER (vérifié dans la table user_profiles)
  EXISTS (
    SELECT 1 
    FROM public.user_profiles 
    WHERE id = auth.uid() 
    AND (role = 'manager' OR role = 'MANAGER')
  )
);
