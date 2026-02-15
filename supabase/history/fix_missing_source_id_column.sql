-- Fix: Add missing source_id column to procedures table
-- This appears to be required by an internal trigger or legacy logic

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'procedures' 
        AND column_name = 'source_id'
    ) THEN
        ALTER TABLE public.procedures ADD COLUMN source_id UUID;
    END IF;
END $$;

-- Notify PostgREST to refresh schema cache
NOTIFY pgrst, 'reload config';
