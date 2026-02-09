-- Add reason columns to missions table
ALTER TABLE public.missions 
ADD COLUMN IF NOT EXISTS completion_notes TEXT,
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- Update status constraint if needed (to include in_progress)
-- Note: Check existing constraint name if it fails. 
-- Usually it's missions_status_check
ALTER TABLE public.missions 
DROP CONSTRAINT IF EXISTS missions_status_check;

ALTER TABLE public.missions 
ADD CONSTRAINT missions_status_check 
CHECK (status IN ('open', 'assigned', 'in_progress', 'completed', 'cancelled'));
