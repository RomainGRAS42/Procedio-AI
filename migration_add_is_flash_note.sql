-- Add is_flash_note column to distinguish Flash Notes from Personal Notes
ALTER TABLE notes 
ADD COLUMN IF NOT EXISTS is_flash_note boolean DEFAULT false;

-- Set all existing notes to is_flash_note = false (they are personal notes)
UPDATE notes 
SET is_flash_note = false 
WHERE is_flash_note IS NULL;

-- Notes with status 'suggestion' or 'public' should be Flash Notes
-- (if they were created through the old system)
UPDATE notes 
SET is_flash_note = true 
WHERE status IN ('suggestion', 'public');

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_notes_is_flash_note ON notes(is_flash_note);
CREATE INDEX IF NOT EXISTS idx_notes_flash_status ON notes(is_flash_note, status);
