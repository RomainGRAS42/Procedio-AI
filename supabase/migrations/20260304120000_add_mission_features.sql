-- Add mission type and recurrence fields to missions table
ALTER TABLE public.missions 
ADD COLUMN IF NOT EXISTS mission_type text DEFAULT 'solo' CHECK (mission_type IN ('solo', 'team', 'challenge')),
ADD COLUMN IF NOT EXISTS recurrence_rule text, -- e.g., 'weekly', 'monthly'
ADD COLUMN IF NOT EXISTS parent_mission_id uuid REFERENCES public.missions(id);

-- Create mission_participants table for team missions
CREATE TABLE IF NOT EXISTS public.mission_participants (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    mission_id uuid REFERENCES public.missions(id) ON DELETE CASCADE,
    user_id uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'validated')),
    contribution_score integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    UNIQUE(mission_id, user_id)
);

-- Add RLS policies for mission_participants
ALTER TABLE public.mission_participants ENABLE ROW LEVEL SECURITY;

-- Allow users to view participants of missions they are part of or if they are managers
CREATE POLICY "Users can view mission participants"
    ON public.mission_participants FOR SELECT
    USING (
        auth.uid() IN (
            SELECT user_id FROM public.mission_participants WHERE mission_id = mission_participants.mission_id
        )
        OR
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'manager'
        )
    );

-- Allow managers to insert/update/delete participants
CREATE POLICY "Managers can manage mission participants"
    ON public.mission_participants FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role = 'manager'
        )
    );

-- Allow users to update their own status
CREATE POLICY "Users can update their own status"
    ON public.mission_participants FOR UPDATE
    USING (user_id = auth.uid());
