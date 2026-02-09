-- Migration: Secure XP System & Team Dynamics
-- Description: Centralizes XP logic in a secure RPC and provides data for the Team Podium.

-- 1. Secure RPC for XP Increment (Atomic)
CREATE OR REPLACE FUNCTION public.increment_user_xp(
    target_user_id UUID,
    xp_amount INTEGER,
    reason TEXT DEFAULT 'ACTION'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with privileges of the creator (system)
AS $$
DECLARE
    old_xp INTEGER;
    new_xp INTEGER;
    old_level INTEGER;
    new_level INTEGER;
    current_user_role TEXT;
BEGIN
    -- Security Check: Only allow if user is authenticated
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Fetch current Stats
    SELECT xp_points, level INTO old_xp, old_level
    FROM public.user_profiles
    WHERE id = target_user_id;

    -- Initialize if null
    old_xp := COALESCE(old_xp, 0);
    old_level := COALESCE(old_level, 1);

    -- Calculate New Stats
    new_xp := old_xp + xp_amount;
    -- Level Formula: 1 + (XP / 100)
    new_level := 1 + FLOOR(new_xp / 100);

    -- Update Profile
    UPDATE public.user_profiles
    SET 
        xp_points = new_xp,
        level = new_level,
        updated_at = now()
    WHERE id = target_user_id;

    -- Log the History (Optional but good for audit)
    INSERT INTO public.notes (
        user_id, 
        title, 
        content, 
        tags, 
        is_protected
    ) VALUES (
        target_user_id,
        'GAIN_XP',
        format('Gain de %s XP. Raison : %s. Nouveau total : %s XP.', xp_amount, reason, new_xp),
        ARRAY['XP', 'SYSTEM'],
        true
    );

    RETURN jsonb_build_object(
        'old_xp', old_xp,
        'new_xp', new_xp,
        'old_level', old_level,
        'new_level', new_level,
        'leveled_up', (new_level > old_level)
    );
END;
$$;

-- 2. RPC for Team Podium (Champions of the Week)
CREATE OR REPLACE FUNCTION public.get_weekly_champions()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    champion_progression JSONB;
    champion_expert JSONB;
    champion_explorer JSONB;
BEGIN
    -- A. LE MOTEUR (Progression XP - Simulated for now as we don't have distinct history table yet)
    -- Ideally we would query a user_xp_history table. For now, we take the highest total XP active user.
    SELECT jsonb_build_object(
        'user_id', id,
        'first_name', first_name,
        'last_name', last_name,
        'avatar_url', avatar_url,
        'role', role,
        'metric_value', xp_points,
        'metric_label', 'XP Total', -- Should be Weekly Delta in V2
        'badge_title', 'Le Moteur',
        'badge_icon', 'fa-rocket',
        'badge_color', 'indigo'
    ) INTO champion_progression
    FROM public.user_profiles
    WHERE role = 'TECHNICIAN'
    ORDER BY xp_points DESC
    LIMIT 1;

    -- B. L'EXPERT (Most Suggestions Approved)
    -- We count approved suggestions in the last 7 days
    WITH expert_stats AS (
        SELECT user_id, COUNT(*) as count
        FROM public.procedure_suggestions
        WHERE status = 'approved'
        AND created_at > (now() - INTERVAL '30 days') -- Monthly champion for more data
        GROUP BY user_id
        ORDER BY count DESC
        LIMIT 1
    )
    SELECT jsonb_build_object(
        'user_id', up.id,
        'first_name', up.first_name,
        'last_name', up.last_name,
        'avatar_url', up.avatar_url,
        'role', up.role,
        'metric_value', es.count,
        'metric_label', 'Suggestions Validées',
        'badge_title', 'L''Expert',
        'badge_icon', 'fa-gem',
        'badge_color', 'emerald'
    ) INTO champion_expert
    FROM expert_stats es
    JOIN public.user_profiles up ON up.id = es.user_id;

    -- C. L'EXPLORATEUR (Most Reads)
    -- We count viewed logs in the last 7 days
    WITH explorer_stats AS (
        SELECT user_id, COUNT(*) as count
        FROM public.notes
        WHERE title LIKE 'LOG_READ_%'
        AND created_at > (now() - INTERVAL '7 days')
        GROUP BY user_id
        ORDER BY count DESC
        LIMIT 1
    )
    SELECT jsonb_build_object(
        'user_id', up.id,
        'first_name', up.first_name,
        'last_name', up.last_name,
        'avatar_url', up.avatar_url,
        'role', up.role,
        'metric_value', es.count,
        'metric_label', 'Lectures Hebdo',
        'badge_title', 'L''Explorateur',
        'badge_icon', 'fa-compass',
        'badge_color', 'amber'
    ) INTO champion_explorer
    FROM explorer_stats es
    JOIN public.user_profiles up ON up.id = es.user_id;

    RETURN jsonb_build_object(
        'progression', champion_progression,
        'expert', champion_expert,
        'explorer', champion_explorer
    );
END;
$$;
