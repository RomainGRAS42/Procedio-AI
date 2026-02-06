-- Add status column for Flash Notes workflow
-- Values: 'private' (default), 'suggestion' (tech to manager), 'public' (visible to all)
ALTER TABLE notes 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'private';

-- Add category column to distinguish standard notes from Flash Notes
ALTER TABLE notes 
ADD COLUMN IF NOT EXISTS category text DEFAULT 'general';

-- Update RLS policies to allow Technicians to read 'public' notes
-- (Assuming existing RLS restricts to user_id. We need to open it up for public notes)
DROP POLICY IF EXISTS "Users can view their own notes" ON notes;
CREATE POLICY "Users can view their own notes OR public notes" 
ON notes FOR SELECT 
USING (
  auth.uid() = user_id 
  OR 
  status = 'public'
);

-- Allow Managers to update any note (to publish suggestions)
-- TECHNICIANS can only update their own notes (to suggest)
DROP POLICY IF EXISTS "Users can update their own notes" ON notes;
CREATE POLICY "Users can update own notes OR Managers can update all" 
ON notes FOR UPDATE 
USING (
  auth.uid() = user_id 
  OR 
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = auth.uid() AND role = 'MANAGER'
  )
);
