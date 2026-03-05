-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE procedures ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE procedure_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggestion_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE procedure_referents ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE rss_feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE mastery_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_expertise ENABLE ROW LEVEL SECURITY;
ALTER TABLE position_referents ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_participants ENABLE ROW LEVEL SECURITY;

-- 1. PROFILES: Users can read all profiles (for team view) but only edit their own
DROP POLICY IF EXISTS "Users can view all profiles" ON user_profiles;
CREATE POLICY "Users can view all profiles" ON user_profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);

-- 2. NOTES: Users see their own private notes + ALL public notes (flash notes) + suggestions they made
-- Managers see everything except private notes of others that are NOT suggestions
DROP POLICY IF EXISTS "Users see own and public notes" ON notes;
CREATE POLICY "Users see own and public notes" ON notes FOR SELECT USING (
  auth.uid() = user_id -- Own notes
  OR status = 'public' -- Flash notes
  OR (status = 'suggestion' AND (auth.uid() = user_id OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'manager')))
);

DROP POLICY IF EXISTS "Users manage own notes" ON notes;
CREATE POLICY "Users manage own notes" ON notes FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Managers can delete public notes" ON notes;
CREATE POLICY "Managers can delete public notes" ON notes FOR DELETE USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'manager')
);

-- 3. PROCEDURES: Everyone can read
DROP POLICY IF EXISTS "Anyone can read procedures" ON procedures;
CREATE POLICY "Anyone can read procedures" ON procedures FOR SELECT USING (true);

-- 4. MISSIONS: 
-- Users see missions assigned to them, created by them, or team missions
-- Managers see all missions
DROP POLICY IF EXISTS "Missions visibility" ON missions;
CREATE POLICY "Missions visibility" ON missions FOR SELECT USING (
  auth.uid() = assigned_to 
  OR auth.uid() = created_by
  OR target_type = 'team'
  OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'manager')
);

DROP POLICY IF EXISTS "Managers manage missions" ON missions;
CREATE POLICY "Managers manage missions" ON missions FOR ALL USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'manager')
);

DROP POLICY IF EXISTS "Users update assigned missions" ON missions;
CREATE POLICY "Users update assigned missions" ON missions FOR UPDATE USING (
  auth.uid() = assigned_to
);

-- 5. NOTIFICATIONS: Users see only their own
DROP POLICY IF EXISTS "Users see own notifications" ON notifications;
CREATE POLICY "Users see own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own notifications" ON notifications;
CREATE POLICY "Users update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- 6. BADGES & XP: Read only for users, Write for system/managers
DROP POLICY IF EXISTS "View badges" ON badges;
CREATE POLICY "View badges" ON badges FOR SELECT USING (true);

DROP POLICY IF EXISTS "View user badges" ON user_badges;
CREATE POLICY "View user badges" ON user_badges FOR SELECT USING (true);

-- 7. SEARCH OPPORTUNITIES: Managers see all, Users can create (search logs)
DROP POLICY IF EXISTS "View search opportunities" ON search_opportunities;
CREATE POLICY "View search opportunities" ON search_opportunities FOR SELECT USING (true);

DROP POLICY IF EXISTS "Create search opportunities" ON search_opportunities;
CREATE POLICY "Create search opportunities" ON search_opportunities FOR INSERT WITH CHECK (true);

-- 8. RSS FEEDS: Users manage their own feeds, see global feeds
DROP POLICY IF EXISTS "View rss feeds" ON rss_feeds;
CREATE POLICY "View rss feeds" ON rss_feeds FOR SELECT USING (
  user_id = auth.uid() OR is_global = true
);

DROP POLICY IF EXISTS "Manage own rss feeds" ON rss_feeds;
CREATE POLICY "Manage own rss feeds" ON rss_feeds FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Managers manage global feeds" ON rss_feeds;
CREATE POLICY "Managers manage global feeds" ON rss_feeds FOR ALL USING (
  is_global = true AND EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'manager')
);
