-- Fix missing completed_at column in missions table
ALTER TABLE public.missions 
ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Update the validate_mission_completion function to handle the column correctly
CREATE OR REPLACE FUNCTION public.validate_mission_completion(mission_id UUID, feedback TEXT)
RETURNS VOID AS $$
DECLARE
    v_user_id UUID;
    v_total_xp INTEGER;
    v_bonus_already_paid BOOLEAN;
    v_final_xp INTEGER;
    v_current_status TEXT;
    v_assigned_to UUID;
    v_mission_record RECORD;
BEGIN
    -- Get mission info
    SELECT * INTO v_mission_record FROM public.missions WHERE id = mission_id;
    
    v_assigned_to := v_mission_record.assigned_to;
    v_total_xp := v_mission_record.xp_reward;
    v_bonus_already_paid := COALESCE(v_mission_record.submission_xp_granted, false);
    v_current_status := v_mission_record.status;

    -- Prevent double validation
    IF v_current_status = 'completed' THEN
        RETURN;
    END IF;

    IF v_assigned_to IS NOT NULL THEN
        -- Calculate remaining XP (Total - 10 if already paid)
        -- Ensure we don't give negative XP if reward is small
        IF v_bonus_already_paid THEN
            v_final_xp := GREATEST(0, v_total_xp - 10);
        ELSE
            v_final_xp := v_total_xp;
        END IF;
        
        -- Grant remaining XP
        PERFORM public.increment_user_xp(v_assigned_to, v_final_xp, 'Mission Completion (Validated)');
        
        -- Mark as completed
        UPDATE public.missions 
        SET status = 'completed',
            manager_feedback = feedback,
            completed_at = NOW()
        WHERE id = mission_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
