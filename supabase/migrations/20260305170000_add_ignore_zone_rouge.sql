-- Add ignore_zone_rouge column to procedures table
ALTER TABLE procedures 
ADD COLUMN IF NOT EXISTS ignore_zone_rouge boolean DEFAULT false;

-- Update RLS policies if necessary (usually public read/write for authenticated users covers new columns if using * selector)
-- Ensure the column is accessible
COMMENT ON COLUMN procedures.ignore_zone_rouge IS 'Flag to hide procedure from Zone Rouge dashboard';
