-- Migration: Extended Gamification System (Badges V2) - Robust Version
-- Description: Adds a comprehensive list of progressive badges for long-term engagement (Reading, Suggestions, Missions)
-- Includes cleanup and constraint enforcement to ensure idempotency.

-- 1. Cleanup duplicates (if any) to allow unique constraint
DELETE FROM public.badges a USING public.badges b
WHERE a.id > b.id AND a.name = b.name;

-- 2. Add Unique Constraint on 'name' to support ON CONFLICT
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'badges_name_key'
    ) THEN
        ALTER TABLE public.badges ADD CONSTRAINT badges_name_key UNIQUE (name);
    END IF;
END
$$;

-- 3. Insert New Badges
INSERT INTO public.badges (name, description, criteria_type, criteria_value, icon, xp_reward)
VALUES 
-- LECTURE (Reading) - Progressive path
('Rat de Bibliothèque', '250 procédures consultées. Une soif insatiable !', 'consultations_count', 250, 'fa-book-atlas', 500),
('Archiviste Suprême', '500 procédures consultées. Vous connaissez la base par cœur.', 'consultations_count', 500, 'fa-landmark', 1000),
('Omniscient', '1000 procédures consultées. Une légende vivante de la documentation.', 'consultations_count', 1000, 'fa-brain', 2000),

-- SUGGESTIONS (Innovation) - Progressive path
('Innovateur', 'Première suggestion proposée. Le début du changement.', 'suggestions_count', 1, 'fa-lightbulb', 50),
('Esprit Critique', '5 suggestions proposées. Votre avis compte.', 'suggestions_count', 5, 'fa-magnifying-glass-plus', 150),
('Architecte du Futur', '20 suggestions proposées. Vous façonnez l''outil de demain.', 'suggestions_count', 20, 'fa-drafting-compass', 500),
('Visionnaire', '50 suggestions proposées. Une force de proposition incontournable.', 'suggestions_count', 50, 'fa-eye', 1500),

-- MISSIONS (Strategy/Action) - Progressive path
('Stratège', 'Première mission accomplie. Bienvenue sur le terrain.', 'missions_count', 1, 'fa-chess-knight', 100),
('Agent de Terrain', '5 missions accomplies. Une fiabilité à toute épreuve.', 'missions_count', 5, 'fa-user-shield', 300),
('Commandant', '20 missions accomplies. Un leader naturel.', 'missions_count', 20, 'fa-medal', 800),
('Légende Opérationnelle', '50 missions accomplies. L''élite de l''élite.', 'missions_count', 50, 'fa-crown', 2500)

ON CONFLICT (name) DO NOTHING;
