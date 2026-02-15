-- Fix: Ensure content column exists in procedures table and refresh schema cache
-- Also ensure Type column exists as it is used by the application

DO $$
BEGIN
    -- Add content column if missing
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'procedures' 
        AND column_name = 'content'
    ) THEN
        ALTER TABLE public.procedures ADD COLUMN content TEXT;
    END IF;

    -- Add Type column if missing (legacy support)
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'procedures' 
        AND column_name = 'Type'
    ) THEN
        ALTER TABLE public.procedures ADD COLUMN "Type" TEXT DEFAULT 'Missions / Transferts';
    END IF;
END $$;

-- Notify PostgREST to refresh schema cache
NOTIFY pgrst, 'reload config';
