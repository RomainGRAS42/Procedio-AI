
-- CORRECTION DU PROBLÈME DE RÉCURSION INFINIE
-- La politique précédente essayait de lire la table 'user_profiles' pour vérifier le droit de lire 'user_profiles', ce qui crée une boucle infinie et bloque tout.

-- 1. On supprime l'ancienne politique bloquante
DROP POLICY IF EXISTS "Managers can view all profiles" ON public.user_profiles;

-- 2. On crée la nouvelle politique qui vérifie le JWT (le jeton de connexion) au lieu de la table
-- Cela évite la boucle infinie car on ne touche pas à la table pour vérifier les droits.

CREATE POLICY "Managers can view all profiles"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (
  -- L'utilisateur peut toujours voir son propre profil
  auth.uid() = id
  OR
  -- Le Manager peut tout voir (vérification via les métadonnées du token, beaucoup plus rapide et sûr)
  -- On gère les majuscules et minuscules par sécurité
  (auth.jwt() -> 'user_metadata' ->> 'role' ILIKE 'manager')
);
