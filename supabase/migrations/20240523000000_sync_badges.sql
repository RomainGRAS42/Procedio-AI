-- Migration: Sync Missing Badges (Retroactive Fix)
-- Description: Adds a function to retroactive award badges based on real stats (consultations count)

-- 1. Ensure Badges Exist (Idempotent)
INSERT INTO public.badges (name, description, criteria_type, criteria_value, icon, xp_reward)
VALUES 
('Lecteur Assidu', 'Vous avez consulté plus de 10 procédures. La connaissance est la clé.', 'consultations_count', 10, 'fa-book-open', 50),
('Lecteur Confirmé', 'Une soif de connaissance ! Plus de 50 procédures consultées.', 'consultations_count', 50, 'fa-glasses', 100),
('Expert Visionnaire', '100 procédures lues. Vous êtes une encyclopédie vivante.', 'consultations_count', 100, 'fa-eye', 300)
ON CONFLICT (name) DO NOTHING;

-- 2. Create Sync Function
CREATE OR REPLACE FUNCTION public.sync_user_badges(user_uuid UUID, current_consultations INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    badge_rec RECORD;
BEGIN
    -- Loop through consultation-based badges
    FOR badge_rec IN SELECT * FROM public.badges WHERE criteria_type = 'consultations_count' LOOP
        
        -- Check eligibility
        IF current_consultations >= badge_rec.criteria_value THEN
            -- Award badge if not already owned
            INSERT INTO public.user_badges (user_id, badge_id, awarded_at)
            VALUES (user_uuid, badge_rec.id, now())
            ON CONFLICT (user_id, badge_id) DO NOTHING;
        END IF;
        
    END LOOP;
END;
$$;

-- 3. Grant Execute Permission
GRANT EXECUTE ON FUNCTION public.sync_user_badges(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_user_badges(UUID, INTEGER) TO service_role;
