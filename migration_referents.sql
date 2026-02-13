-- Create procedure_referents table
CREATE TABLE IF NOT EXISTS position_referents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  procedure_id UUID NOT NULL REFERENCES procedures(uuid) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  assigned_by UUID REFERENCES user_profiles(id),
  CONSTRAINT unique_procedure_referent UNIQUE (procedure_id)
);

-- RLS Policies
ALTER TABLE position_referents ENABLE ROW LEVEL SECURITY;

-- Everyone can read referents
CREATE POLICY "Public read access" ON position_referents
  FOR SELECT USING (true);

-- Only Managers can insert/delete (Manage referents)
-- Assuming we serve roles via a fast check or auth.jwt()
-- For simplicity in this migration, allow authenticated users if they are managers
-- But since we often use service_role for admin tasks or handle logic in Edge Functions, we'll keep it simple for now:

CREATE POLICY "Managers can manage referents" ON position_referents
  FOR ALL
  USING (
    exists (
      select 1 from user_profiles
      where id = auth.uid()
      and role = 'manager'
    )
  );
