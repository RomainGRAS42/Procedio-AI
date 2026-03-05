-- 1. Create xp_history table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.xp_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.user_profiles(id) NOT NULL,
    amount INTEGER NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Update increment_user_xp to use xp_history
CREATE OR REPLACE FUNCTION public.increment_user_xp(
    target_user_id UUID,
    xp_amount INTEGER,
    reason TEXT DEFAULT 'ACTION'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    old_xp INTEGER;
    new_xp INTEGER;
    old_level INTEGER;
    new_level INTEGER;
BEGIN
    -- Security Check
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Fetch current Stats
    SELECT xp_points, level INTO old_xp, old_level
    FROM public.user_profiles
    WHERE id = target_user_id;

    old_xp := COALESCE(old_xp, 0);
    old_level := COALESCE(old_level, 1);

    -- Calculate New Stats
    new_xp := old_xp + xp_amount;
    new_level := 1 + FLOOR(new_xp / 100);

    -- Update Profile
    UPDATE public.user_profiles
    SET 
        xp_points = new_xp,
        level = new_level,
        updated_at = now()
    WHERE id = target_user_id;

    -- Insert into History
    INSERT INTO public.xp_history (user_id, amount, reason)
    VALUES (target_user_id, xp_amount, reason);

    -- Log to Notes (Legacy/UI)
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

-- 3. Update get_weekly_champions to use xp_history and exclude managers
CREATE OR REPLACE FUNCTION get_weekly_champions()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    start_date timestamptz := date_trunc('week', now());
    progression_champ json;
    expert_champ json;
    explorer_champ json;
BEGIN
    -- 1. TOP PERFORMANCE (XP gained this week)
    SELECT row_to_json(t) INTO progression_champ
    FROM (
        SELECT 
            p.id as user_id,
            p.first_name,
            p.last_name,
            p.avatar_url,
            p.role,
            COALESCE(SUM(xh.amount), 0) as metric_value,
            'XP GÉNÉRÉS' as metric_label,
            'TOP PERFORMANCE' as badge_title,
            'fa-rocket' as badge_icon,
            'indigo' as badge_color
        FROM user_profiles p
        JOIN xp_history xh ON p.id = xh.user_id
        WHERE xh.created_at >= start_date
        AND p.role != 'manager' -- Exclude managers
        GROUP BY p.id
        ORDER BY metric_value DESC
        LIMIT 1
    ) t;

    -- 2. TOP CONTRIBUTION (Suggestions approved this week)
    SELECT row_to_json(t) INTO expert_champ
    FROM (
        SELECT 
            p.id as user_id,
            p.first_name,
            p.last_name,
            p.avatar_url,
            p.role,
            COUNT(s.id) as metric_value,
            'SUGGESTIONS VALIDÉES' as metric_label,
            'TOP CONTRIBUTION' as badge_title,
            'fa-gem' as badge_icon,
            'emerald' as badge_color
        FROM user_profiles p
        JOIN procedure_suggestions s ON p.id = s.user_id
        WHERE s.created_at >= start_date 
        AND s.status = 'approved'
        AND p.role != 'manager' -- Exclude managers
        GROUP BY p.id
        ORDER BY metric_value DESC
        LIMIT 1
    ) t;

    -- 3. TOP CURIOSITÉ (Procedures viewed this week)
    SELECT row_to_json(t) INTO explorer_champ
    FROM (
        SELECT 
            p.id as user_id,
            p.first_name,
            p.last_name,
            p.avatar_url,
            p.role,
            COUNT(DISTINCT n.content) as metric_value,
            'PROCÉDURES CONSULTÉES' as metric_label,
            'TOP CURIOSITÉ' as badge_title,
            'fa-compass' as badge_icon,
            'amber' as badge_color
        FROM user_profiles p
        JOIN notes n ON p.id = n.user_id
        WHERE n.created_at >= start_date 
        AND n.title LIKE 'CONSULTATION_%'
        AND p.role != 'manager' -- Exclude managers
        GROUP BY p.id
        ORDER BY metric_value DESC
        LIMIT 1
    ) t;

    RETURN json_build_object(
        'progression', progression_champ,
        'expert', expert_champ,
        'explorer', explorer_champ
    );
END;
$$;
