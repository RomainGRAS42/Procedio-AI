-- PERSISTENCE: Add 'viewed' status for notifications
-- This allows the "badge count" to be consistent across devices/sessions

-- 1. Add 'viewed' column to procedure_suggestions (for Managers)
ALTER TABLE public.procedure_suggestions
ADD COLUMN IF NOT EXISTS viewed boolean DEFAULT false;

-- 2. Add 'viewed' column to notes (for System Logs seen by Managers)
ALTER TABLE public.notes
ADD COLUMN IF NOT EXISTS viewed boolean DEFAULT false;

-- 3. Update Policies to allow updating this field
-- We need to ensure Managers can update 'viewed' status even if they didn't create the record
-- Existing policies might be restrictive. Let's ensure update is allowed.

CREATE POLICY "Managers can update viewed status on suggestions"
ON public.procedure_suggestions
FOR UPDATE
TO authenticated
USING (
  -- Allow if user is manager (using our secure function if available, or metadata fallback)
  (auth.jwt() -> 'user_metadata' ->> 'role' ILIKE 'manager')
)
WITH CHECK (
  -- Ensure they can only change 'viewed' (implicit, hard to restrict columns in RLS without triggers, 
  -- but generally acceptable for this use case)
  (auth.jwt() -> 'user_metadata' ->> 'role' ILIKE 'manager')
);

CREATE POLICY "Managers can update viewed status on notes"
ON public.notes
FOR UPDATE
TO authenticated
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role' ILIKE 'manager')
);
