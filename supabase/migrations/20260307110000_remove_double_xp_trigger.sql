-- Remove the trigger that causes double XP counting
-- The trigger name was found to be 'tr_award_mission_xp'
DROP TRIGGER IF EXISTS tr_award_mission_xp ON public.missions;

-- Also try other potential names just in case (though error confirmed one)
DROP TRIGGER IF EXISTS on_mission_completed ON public.missions;
DROP TRIGGER IF EXISTS trg_award_mission_xp ON public.missions;
DROP TRIGGER IF EXISTS award_mission_xp ON public.missions;

-- Drop the function that was used by the trigger
DROP FUNCTION IF EXISTS public.award_mission_xp();
