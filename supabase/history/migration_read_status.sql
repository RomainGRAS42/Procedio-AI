-- Add is_read_by_manager column to procedure_suggestions
ALTER TABLE procedure_suggestions 
ADD COLUMN IF NOT EXISTS is_read_by_manager BOOLEAN DEFAULT FALSE;

-- Add is_read_by_manager column to mastery_requests
ALTER TABLE mastery_requests 
ADD COLUMN IF NOT EXISTS is_read_by_manager BOOLEAN DEFAULT FALSE;

-- Optional: Mark all existing completed/approved/rejected items as READ to avoid flooding the manager
UPDATE procedure_suggestions SET is_read_by_manager = TRUE WHERE status != 'pending';
UPDATE mastery_requests SET is_read_by_manager = TRUE WHERE status != 'pending';
