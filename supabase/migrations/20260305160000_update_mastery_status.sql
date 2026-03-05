-- Update mastery_requests status constraint to allow 'approved_referent'
ALTER TABLE mastery_requests DROP CONSTRAINT IF EXISTS mastery_requests_status_check;

ALTER TABLE mastery_requests 
ADD CONSTRAINT mastery_requests_status_check 
CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'approved_referent'));
