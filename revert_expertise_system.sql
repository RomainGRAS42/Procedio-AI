-- DANGER: This script will delete all data related to the Expertise System (Badges, Referent assignments, etc.)

-- 1. Drop constraints and referent records
DROP TABLE IF EXISTS public.procedure_referents CASCADE;

-- 2. Drop user badges and badge catalog
DROP TABLE IF EXISTS public.user_badges CASCADE;
DROP TABLE IF EXISTS public.badges CASCADE;

-- 3. Remove columns from existing tables
ALTER TABLE public.procedures DROP COLUMN IF EXISTS is_trend;
ALTER TABLE public.procedure_suggestions DROP COLUMN IF EXISTS referent_id;

-- 4. Clean up related notifications (Mastery claims)
DELETE FROM public.notes WHERE title LIKE 'CLAIM_MASTERY_%';

DROP TYPE IF EXISTS public.badge_type;
