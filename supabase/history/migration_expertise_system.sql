-- Migration: Create Expertise System
-- Description: Adds tables for manual/auto badges and delegation to referents.

-- 1. Create Badge Type Enum
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'badge_type') THEN
        CREATE TYPE badge_type AS ENUM ('auto', 'manual');
    END IF;
END $$;

-- 2. Create Badges Table
CREATE TABLE IF NOT EXISTS public.badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    type badge_type NOT NULL DEFAULT 'auto',
    icon TEXT, -- FontAwesome class name
    xp_reward INTEGER DEFAULT 0,
    is_ephemeral BOOLEAN DEFAULT false,
    validity_months INTEGER,
    category TEXT, -- Optional: link to a procedure category
    procedure_id UUID REFERENCES public.procedures(uuid) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create User Badges Table
CREATE TABLE IF NOT EXISTS public.user_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    badge_id UUID REFERENCES public.badges(id) ON DELETE CASCADE,
    awarded_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ,
    awarded_by UUID REFERENCES public.user_profiles(id), -- Manager or Referent ID
    UNIQUE(user_id, badge_id)
);

-- 4. Create Procedure Referents Table (for delegated validation)
CREATE TABLE IF NOT EXISTS public.procedure_referents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    procedure_id UUID REFERENCES public.procedures(uuid) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(procedure_id, user_id)
);

-- 5. Enable RLS
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procedure_referents ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies (Safe handling with IF NOT EXISTS logic equivalent)

DO $$ 
BEGIN
    -- Badges: Everyone can read
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read on badges') THEN
        CREATE POLICY "Allow public read on badges" ON public.badges FOR SELECT USING (true);
    END IF;

    -- Badges: Only managers can manage
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow managers to manage badges') THEN
        CREATE POLICY "Allow managers to manage badges" ON public.badges FOR ALL USING (
            EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'manager')
        );
    END IF;

    -- User Badges: Everyone can read
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read on user_badges') THEN
        CREATE POLICY "Allow public read on user_badges" ON public.user_badges FOR SELECT USING (true);
    END IF;

    -- User Badges: Managers can award
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow managers to award badges') THEN
        CREATE POLICY "Allow managers to award badges" ON public.user_badges FOR INSERT WITH CHECK (
            EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'manager')
        );
    END IF;

    -- Procedure Referents: Everyone can read
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read on referents') THEN
        CREATE POLICY "Allow public read on referents" ON public.procedure_referents FOR SELECT USING (true);
    END IF;

    -- Procedure Referents: Only managers can manage
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow managers to manage referents') THEN
        CREATE POLICY "Allow managers to manage referents" ON public.procedure_referents FOR ALL USING (
            EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'manager')
        );
    END IF;
END $$;

-- 7. Add primary key to existing procedure_suggestions if not already there (it should be)
-- 8. Add referent_id to procedure_suggestions for delegated validation tracking
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'procedure_suggestions' AND column_name = 'referent_id') THEN
        ALTER TABLE public.procedure_suggestions ADD COLUMN referent_id UUID REFERENCES public.user_profiles(id);
    END IF;
END $$;

-- 9. Add comments
COMMENT ON TABLE public.badges IS 'Catalogue des badges disponibles (Automatiques et Maîtrise Manager)';
COMMENT ON TABLE public.user_badges IS 'Attribution des badges aux techniciens avec gestion de l expiration';
COMMENT ON TABLE public.procedure_referents IS 'Liste des techniciens experts (Référants) par procédure pour la validation déléguée';
