-- 1. Nettoyage des badges existants (pour repartir proprement)
DELETE FROM public.badges;

-- 2. Insertion des nouveaux badges avec "Copywriting" amélioré et paliers progressifs
INSERT INTO public.badges (name, description, criteria_type, criteria_value, category) VALUES
-- Paliers Globaux (XP Totale)
('Explorateur', 'Premiers pas dans l''univers Procedio. La curiosité est un vilain défaut, sauf ici.', 'total_xp', 100, NULL),
('Baroudeur', 'Vous commencez à connaître les rouages de la machine. Un atout fiable.', 'total_xp', 500, NULL),
('Vétéran', 'Les procédures n''ont plus de secret pour vous. Une référence pour l''équipe.', 'total_xp', 1500, NULL),
('Légende', 'Votre savoir est immense. Vous ne suivez plus la voie, vous la tracez.', 'total_xp', 5000, NULL),

-- Paliers Catégorie : LOGICIEL
('Néophyte Digital', 'Premières armes sur les outils logiciels.', 'category_xp', 100, 'LOGICIEL'),
('Virtuose du Clavier', 'Une maîtrise fluide des environnements numériques.', 'category_xp', 500, 'LOGICIEL'),
('Oracle du Code', 'Debugger, configurer, optimiser : un jeu d''enfant.', 'category_xp', 2000, 'LOGICIEL'),

-- Paliers Catégorie : MATÉRIEL
('Monteur Amateur', 'Vous savez distinguer une vis d''un condensateur.', 'category_xp', 100, 'MATERIEL'),
('Chirurgien de la Tour', 'Interventions précises et diagnostiques affûtés.', 'category_xp', 500, 'MATERIEL'),
('Deus Ex Machina', 'Le hardware vous obéit au doigt et à l''œil.', 'category_xp', 2000, 'MATERIEL'),

-- Paliers Catégorie : INFRASTRUCTURE
('Câbleur', 'Les bases de la connectivité sont acquises.', 'category_xp', 100, 'INFRASTRUCTURE'),
('Garde-Réseau', 'Vous veillez au grain sur les flux de données.', 'category_xp', 500, 'INFRASTRUCTURE'),
('Architecte Cloud', 'Une vision globale et structurée des systèmes complexes.', 'category_xp', 2000, 'INFRASTRUCTURE');


-- 3. Mise à jour de la formule de calcul de niveau (Courbe Quadratique)
-- Ancienne formule : 1 niveau tous les 100 XP (Linéaire)
-- Nouvelle formule : Niveau = racine(XP) / 5 (Progressive)
-- Ex: 100 XP = Lv 3, 500 XP = Lv 5, 2500 XP = Lv 11
-- Ou plus dur : racine(XP) / 10 + 1
-- 100 XP -> 10/10 + 1 = Lv 2
-- 400 XP -> 20/10 + 1 = Lv 3
-- 900 XP -> 30/10 + 1 = Lv 4
-- 2500 XP -> 50/10 + 1 = Lv 6 (L'ancien Lv 6 demandait 500 XP, maintenant 2500 XP !)

CREATE OR REPLACE FUNCTION public.award_mission_xp()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Si le statut passe à 'completed'
  IF (OLD.status != 'completed' AND NEW.status = 'completed') THEN
    -- Mettre à jour l'XP de l'assigné
    UPDATE public.user_profiles 
    SET 
      xp_points = xp_points + NEW.xp_reward,
      -- Nouvelle formule quadratique : N = floor(sqrt(XP)/10) + 1
      level = floor(sqrt(xp_points + NEW.xp_reward) / 10) + 1
    WHERE id = NEW.assigned_to;
    
    -- Optionnel : Loguer l'activité dans les notes de log
    INSERT INTO public.notes (title, content, user_id, status)
    VALUES (
      'LOG_MISSION_COMPLETED', 
      '✅ Mission accomplie : ' || NEW.title || ' (+' || NEW.xp_reward || ' XP)', 
      NEW.assigned_to,
      'private'
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- 4. Recalculer les niveaux de tous les utilisateurs existants pour appliquer la nouvelle formule
UPDATE public.user_profiles
SET level = floor(sqrt(xp_points) / 10) + 1;
