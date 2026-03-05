-- Add category column to missions table if it doesn't exist
ALTER TABLE public.missions 
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT NULL;

-- Update RLS policies to include the new column (implicitly covered by existing policies but good practice to verify)
-- Existing policies usually cover all columns unless specified otherwise.
