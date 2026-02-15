-- Fix: Add missing 'tags' column to notes table
-- This is required for the increment_user_xp function to work correctly

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'notes' 
        AND column_name = 'tags'
    ) THEN
        ALTER TABLE public.notes ADD COLUMN tags TEXT[] DEFAULT '{}';
    END IF;
END $$;
