DROP FUNCTION IF EXISTS public.validate_mission_completion(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.validate_mission_completion(mission_id UUID, feedback TEXT)
RETURNS VOID AS $$
DECLARE
    v_user_id UUID;
    v_total_xp INTEGER;
    v_bonus_already_paid BOOLEAN;
    v_final_xp INTEGER;
    v_current_status TEXT;
BEGIN
    -- Get mission info
    SELECT assigned_to, xp_reward, submission_xp_granted, status 
    INTO v_user_id, v_total_xp, v_bonus_already_paid, v_current_status
    FROM public.missions
    WHERE id = mission_id;

    -- Prevent double validation
    IF v_current_status = 'completed' THEN
        RETURN;
    END IF;

    IF v_user_id IS NOT NULL THEN
        -- Calculate remaining XP (Total - 10 if already paid)
        v_final_xp := CASE WHEN v_bonus_already_paid THEN v_total_xp - 10 ELSE v_total_xp END;
        
        -- Grant remaining XP
        PERFORM public.increment_user_xp(v_user_id, v_final_xp, 'Mission Completion (Validated)');
        
        -- Mark as completed
        UPDATE public.missions 
        SET status = 'completed',
            manager_feedback = feedback,
            completed_at = NOW()
        WHERE id = mission_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
