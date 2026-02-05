-- Enable RLS for Announcement Tables
ALTER TABLE "public"."announcement_reads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."team_announcements" ENABLE ROW LEVEL SECURITY;

-- Policies for announcement_reads
-- 1. Users can INSERT their own read receipts
DROP POLICY IF EXISTS "Users can insert their own reads" ON "public"."announcement_reads";
CREATE POLICY "Users can insert their own reads" ON "public"."announcement_reads"
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 2. Users can SELECT their own read receipt (to see personalized message)
DROP POLICY IF EXISTS "Users can view their own reads" ON "public"."announcement_reads";
CREATE POLICY "Users can view their own reads" ON "public"."announcement_reads"
FOR SELECT USING (auth.uid() = user_id);

-- 3. Users can UPDATE their own read receipts (if logic requires it)
DROP POLICY IF EXISTS "Users can update their own reads" ON "public"."announcement_reads";
CREATE POLICY "Users can update their own reads" ON "public"."announcement_reads"
FOR UPDATE USING (auth.uid() = user_id);

-- Policies for team_announcements
-- 1. Everyone (Team) can READ announcements
DROP POLICY IF EXISTS "Everyone can read announcements" ON "public"."team_announcements";
CREATE POLICY "Everyone can read announcements" ON "public"."team_announcements"
FOR SELECT USING (true);

-- 2. Managers can INSERT/UPDATE/DELETE announcements
DROP POLICY IF EXISTS "Managers can manage announcements" ON "public"."team_announcements";
CREATE POLICY "Managers can manage announcements" ON "public"."team_announcements"
FOR ALL USING (
  exists (
    select 1 from public.user_profiles
    where id = auth.uid() and role = 'manager'
  )
);
