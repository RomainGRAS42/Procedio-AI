-- Migration Phase 4: Proof of Work & Validation

-- 1. Update missions table with new columns
ALTER TABLE public.missions 
ADD COLUMN IF NOT EXISTS needs_attachment BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS attachment_url TEXT,
ADD COLUMN IF NOT EXISTS manager_feedback TEXT,
ADD COLUMN IF NOT EXISTS submission_xp_granted BOOLEAN DEFAULT false;

-- 2. Update mission status enum (check if exists or use text)
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mission_status') THEN
        -- Add awaiting_validation to existing enum if it's a custom type
        -- Note: Postgres doesn't allow adding values inside a transaction easily for enums
        -- We might need to handle it as text if the app uses text
        NULL;
    END IF;
END $$;

-- 3. Create Storage Bucket for mission attachments
-- Note: This is usually done via API or specialized SQL if the mcp allows it.
-- We'll assume the storage setup is handled or documented via RLS policies.

-- Set RLS for Storage (public.objects is where Supabase stores folder info)
-- Note: This requires the storage extension to be active.
-- We will define the RLS policies for the 'mission-attachments' bucket.

-- POLICY: Technicians can upload to their assigned missions
-- POLICY: Managers can view all attachments

-- 4. RPC for split XP (Submission Reward)
CREATE OR REPLACE FUNCTION public.reward_mission_submission(mission_id UUID)
RETURNS VOID AS $$
DECLARE
    v_user_id UUID;
    v_already_granted BOOLEAN;
    v_bonus_xp INTEGER := 10; -- Bonus XP for submission
BEGIN
    -- Get mission info
    SELECT assigned_to, submission_xp_granted INTO v_user_id, v_already_granted
    FROM public.missions
    WHERE id = mission_id;

    IF v_user_id IS NOT NULL AND NOT v_already_granted THEN
        -- Grant bonus XP
        PERFORM public.increment_user_xp(v_user_id, v_bonus_xp, 'Mission Submission Bonus');
        
        -- Mark as granted
        UPDATE public.missions 
        SET submission_xp_granted = true,
            status = 'awaiting_validation'
        WHERE id = mission_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RPC for Final Mission Validation
CREATE OR REPLACE FUNCTION public.validate_mission_completion(mission_id UUID, feedback TEXT)
RETURNS VOID AS $$
DECLARE
    v_user_id UUID;
    v_total_xp INTEGER;
    v_bonus_already_paid BOOLEAN;
    v_final_xp INTEGER;
BEGIN
    -- Get mission info
    SELECT assigned_to, xp_reward, submission_xp_granted INTO v_user_id, v_total_xp, v_bonus_already_paid
    FROM public.missions
    WHERE id = mission_id;

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
