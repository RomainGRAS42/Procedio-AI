-- Add 'type' column to mission_messages table for system messages
ALTER TABLE mission_messages
ADD COLUMN type text DEFAULT 'text'; -- 'text' or 'system'

-- Optional: Add payload column if we want to store structured data for system messages later
-- ALTER TABLE mission_messages ADD COLUMN payload jsonb;
