-- Create flash_note_responses table for notifications (similar to suggestion_responses)
CREATE TABLE IF NOT EXISTS flash_note_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid REFERENCES notes(id) ON DELETE CASCADE,
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE,
  manager_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('approved', 'rejected')),
  manager_response text,
  note_title text,
  note_content text,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(note_id, user_id)
);

-- RLS policies for flash_note_responses
ALTER TABLE flash_note_responses ENABLE ROW LEVEL SECURITY;

-- Users can read their own responses
CREATE POLICY "Users can view their own flash note responses"
ON flash_note_responses FOR SELECT
USING (auth.uid() = user_id);

-- Managers can insert responses
CREATE POLICY "Managers can create flash note responses"
ON flash_note_responses FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'manager'
  )
);

-- Users can update read status
CREATE POLICY "Users can update read status"
ON flash_note_responses FOR UPDATE
USING (auth.uid() = user_id);
