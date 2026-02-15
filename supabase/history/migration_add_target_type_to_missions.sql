-- Add target_type column to missions table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'missions' AND column_name = 'target_type') THEN
        ALTER TABLE missions ADD COLUMN target_type text DEFAULT 'team';
    END IF;
END $$;
