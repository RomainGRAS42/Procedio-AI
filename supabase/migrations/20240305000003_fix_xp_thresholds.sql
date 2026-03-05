-- Fix increment_user_xp to match TypeScript XP_THRESHOLDS
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
    
    -- Calculate Level based on XP_THRESHOLDS
    -- Level 1: 0
    -- Level 2: 300
    -- Level 3: 1000
    -- Level 4: 2200
    -- Level 5: 4600
    -- Level 6: 8200
    -- Level 7: 12600
    -- Level 8: 18600
    -- Level 9: 26600
    -- Level 10: 36600
    IF new_xp < 300 THEN new_level := 1;
    ELSIF new_xp < 1000 THEN new_level := 2;
    ELSIF new_xp < 2200 THEN new_level := 3;
    ELSIF new_xp < 4600 THEN new_level := 4;
    ELSIF new_xp < 8200 THEN new_level := 5;
    ELSIF new_xp < 12600 THEN new_level := 6;
    ELSIF new_xp < 18600 THEN new_level := 7;
    ELSIF new_xp < 26600 THEN new_level := 8;
    ELSIF new_xp < 36600 THEN new_level := 9;
    ELSE new_level := 10;
    END IF;

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
