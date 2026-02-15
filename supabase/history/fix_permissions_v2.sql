
-- Version corrigée : les énumérations PostgreSQL sont sensibles à la casse.
-- Si votre type enum 'user_role' contient 'manager' (minuscule), 'MANAGER' (majuscule) provoquera une erreur.
-- Cette requête utilise uniquement la valeur minuscule 'manager' qui est standard dans votre base.

CREATE POLICY "Managers can view all profiles"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (
  -- 1. L'utilisateur voit son propre profil
  (auth.uid() = id)
  OR
  -- 2. OU l'utilisateur est un manager (valeur 'manager' minuscule uniquement)
  EXISTS (
    SELECT 1 
    FROM public.user_profiles 
    WHERE id = auth.uid() 
    AND role = 'manager'::user_role
  )
);
