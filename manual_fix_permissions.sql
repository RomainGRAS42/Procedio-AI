-- ============================================================================
-- FIX PERMISSIONS MANUEL (RLS)
-- À exécuter dans l'éditeur SQL de Supabase (Tableau de bord -> SQL Editor)
-- ============================================================================

-- 1. Activer la sécurité RLS sur la table missions (au cas où)
ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;

-- 2. Nettoyer les anciennes politiques qui bloquent
DROP POLICY IF EXISTS "Users can view their own missions" ON public.missions;
DROP POLICY IF EXISTS "Users can create missions" ON public.missions;
DROP POLICY IF EXISTS "Users can update their missions" ON public.missions;
DROP POLICY IF EXISTS "Users can delete their missions" ON public.missions;

-- 3. Créer la politique de LECTURE (SELECT)
-- Tout le monde voit :
-- - Ses propres missions assignées
-- - Les missions qu'il a créées
-- - Les missions "open" (pour les prendre)
-- - Les MANAGERS voient TOUT
CREATE POLICY "Users can view their own missions"
ON public.missions
FOR SELECT
TO authenticated
USING (
  auth.uid() = assigned_to OR 
  auth.uid() = created_by OR
  status = 'open' OR
  (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'MANAGER'
);

-- 4. Créer la politique d'ÉCRITURE (INSERT)
-- Seuls les créateurs (Managers/Techs autorisés) peuvent insérer
CREATE POLICY "Users can create missions"
ON public.missions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by
);

-- 5. Créer la politique de MISE À JOUR (UPDATE)
-- CRUCIAL : C'est ici que ça bloquait pour le "Démarrer"
-- L'assigné DOIT pouvoir modifier le statut
CREATE POLICY "Users can update their missions"
ON public.missions
FOR UPDATE
TO authenticated
USING (
  auth.uid() = assigned_to OR           -- Je suis le technicien assigné
  auth.uid() = created_by OR            -- C'est moi qui l'ai créée
  (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'MANAGER' -- Je suis manager
)
WITH CHECK (
  auth.uid() = assigned_to OR 
  auth.uid() = created_by OR
  (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'MANAGER'
);

-- 6. Créer la politique de SUPPRESSION (DELETE)
CREATE POLICY "Users can delete their missions"
ON public.missions
FOR DELETE
TO authenticated
USING (
  auth.uid() = created_by OR
  (SELECT role FROM public.user_profiles WHERE id = auth.uid()) = 'MANAGER'
);
