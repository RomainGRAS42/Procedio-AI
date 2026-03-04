-- Migration to add display_duration and expires_at to notes table
ALTER TABLE notes 
ADD COLUMN IF NOT EXISTS display_duration TEXT DEFAULT 'infinite',
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

-- Add comment to columns
COMMENT ON COLUMN notes.display_duration IS 'Duration for Flash Note visibility: 1h, 24h, 1week, 1month, infinite';
COMMENT ON COLUMN notes.expires_at IS 'Exact timestamp when the note should stop being displayed';