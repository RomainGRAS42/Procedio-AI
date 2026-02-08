-- Migration: Search Opportunities System (STABLE V3)
-- Description: Automated tracking of missed searches via the existing 'notes' table.
-- Correction: Fixed 'manager' case to match user_role enum.

-- 1. Enable pg_trgm for fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Create Search Opportunities table
CREATE TABLE IF NOT EXISTS public.search_opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    term TEXT UNIQUE NOT NULL,
    search_count INTEGER DEFAULT 1,
    last_searched_at TIMESTAMPTZ DEFAULT now(),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'resolved')),
    category TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Trigger Function: Aggregate from notes
CREATE OR REPLACE FUNCTION public.aggregate_from_notes()
RETURNS TRIGGER AS $$
DECLARE
    search_term TEXT;
    existing_id UUID;
BEGIN
    IF (NEW.title LIKE 'LOG_SEARCH_FAIL_%') THEN
        search_term := lower(replace(NEW.title, 'LOG_SEARCH_FAIL_', ''));
        
        SELECT id INTO existing_id
        FROM public.search_opportunities
        WHERE status = 'pending'
          AND similarity(term, search_term) > 0.6
        ORDER BY similarity(term, search_term) DESC
        LIMIT 1;
        
        IF existing_id IS NOT NULL THEN
            UPDATE public.search_opportunities
            SET search_count = search_count + 1,
                last_searched_at = now()
            WHERE id = existing_id;
        ELSE
            INSERT INTO public.search_opportunities (term, search_count, last_searched_at)
            VALUES (search_term, 1, now())
            ON CONFLICT (term) DO UPDATE 
            SET search_count = search_opportunities.search_count + 1,
                last_searched_at = now();
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_aggregate_from_notes ON public.notes;
CREATE TRIGGER tr_aggregate_from_notes
AFTER INSERT ON public.notes
FOR EACH ROW
EXECUTE FUNCTION public.aggregate_from_notes();

-- 4. Trigger Function: Resolve on ANY procedure title update or creation
CREATE OR REPLACE FUNCTION public.resolve_search_opportunity_final()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.search_opportunities
    SET status = 'resolved'
    WHERE status = 'pending'
      AND (
          NEW.title ILIKE '%' || term || '%' OR
          similarity(term, NEW.title) > 0.5
      );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_resolve_search_opportunity ON public.procedures;
CREATE TRIGGER tr_resolve_search_opportunity
AFTER INSERT OR UPDATE OF title ON public.procedures
FOR EACH ROW
EXECUTE FUNCTION public.resolve_search_opportunity_final();

-- 5. Backfill historical data
INSERT INTO public.search_opportunities (term, search_count, last_searched_at)
SELECT lower(replace(title, 'LOG_SEARCH_FAIL_', '')), count(*), max(created_at)
FROM public.notes WHERE title LIKE 'LOG_SEARCH_FAIL_%' GROUP BY 1
ON CONFLICT (term) DO NOTHING;

-- 6. RLS
ALTER TABLE public.search_opportunities ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow managers to view opportunities') THEN
        CREATE POLICY "Allow managers to view opportunities"
        ON public.search_opportunities FOR SELECT
        USING ( 
            EXISTS ( 
                SELECT 1 FROM public.user_profiles 
                WHERE id = auth.uid() AND (role = 'manager' OR role = 'MANAGER') -- Robust check for both cases
            ) 
        );
    END IF;
END $$;
