-- FIX: RLS Policies for User Profiles (Avatar Upload) and Suggestions (Notifications)

-- 1. Enable RLS on user_profiles (if not already enabled)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 2. Allow users to view all profiles (necessary for Manager to see Technician names in suggestions)
CREATE POLICY "Enable read access for all users"
ON user_profiles FOR SELECT
USING (true);

-- 3. Allow users to insert their OWN profile (fixes "new row violates..." on first login/creation)
CREATE POLICY "Enable insert for users based on user_id"
ON user_profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- 4. Allow users to update their OWN profile (fixes "new row violates..." on avatar upload)
CREATE POLICY "Enable update for users based on user_id"
ON user_profiles FOR UPDATE
USING (auth.uid() = id);

-- 5. Fix RLS for procedure_suggestions (Manager Notification Issue)
-- Enable RLS
ALTER TABLE procedure_suggestions ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users (Technicians) to create suggestions
CREATE POLICY "Enable insert for authenticated users"
ON procedure_suggestions FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users (Managers) to view all suggestions
-- This ensures the Manager can see suggestions created by Technicians
CREATE POLICY "Enable read access for all authenticated users"
ON procedure_suggestions FOR SELECT
USING (auth.role() = 'authenticated');

-- Optional: Allow Managers to update status (approve/reject)
CREATE POLICY "Enable update for authenticated users"
ON procedure_suggestions FOR UPDATE
USING (auth.role() = 'authenticated');
