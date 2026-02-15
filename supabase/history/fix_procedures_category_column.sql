-- Fix: Ensure category column exists in procedures table and refresh schema cache

-- 1. Add category column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'procedures' 
        AND column_name = 'category'
    ) THEN
        ALTER TABLE public.procedures ADD COLUMN category TEXT DEFAULT 'Missions / Transferts';
    END IF;
END $$;

-- 2. Notify PostgREST to refresh schema cache
NOTIFY pgrst, 'reload config';
