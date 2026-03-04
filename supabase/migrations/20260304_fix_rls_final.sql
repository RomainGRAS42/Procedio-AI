-- Ensure we are using the correct schema
-- We assume storage schema exists and tables exist.

-- Create the avatars bucket if it doesn't exist (using INSERT ON CONFLICT)
-- We use a DO block to avoid errors if the table doesn't exist (though it should)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
        INSERT INTO storage.buckets (id, name, public)
        VALUES ('avatars', 'avatars', true)
        ON CONFLICT (id) DO UPDATE SET public = true;
    END IF;
END $$;

-- Drop existing policies to avoid conflicts on storage.objects
-- We use DO blocks to handle potential missing tables or permissions gracefully
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
        execute 'drop policy if exists "Avatar images are publicly accessible" on storage.objects';
        execute 'drop policy if exists "Users can upload their own avatar" on storage.objects';
        execute 'drop policy if exists "Users can update their own avatar" on storage.objects';
        execute 'drop policy if exists "Users can delete their own avatar" on storage.objects';
        execute 'drop policy if exists "Authenticated users can upload avatars" on storage.objects';
        execute 'drop policy if exists "Give users access to own folder 1ok1k3j_0" on storage.objects';
        execute 'drop policy if exists "Give users access to own folder 1ok1k3j_1" on storage.objects';
        execute 'drop policy if exists "Give users access to own folder 1ok1k3j_2" on storage.objects';
        execute 'drop policy if exists "Give users access to own folder 1ok1k3j_3" on storage.objects';
    END IF;
END $$;

-- Create comprehensive policies for the avatars bucket
-- 1. Public Read Access
create policy "Avatar images are publicly accessible"
on storage.objects for select
using ( bucket_id = 'avatars' );

-- 2. Authenticated Upload (INSERT)
-- Allow users to upload files to the 'avatars' bucket. 
create policy "Users can upload their own avatar"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars' AND
  (name LIKE (auth.uid()::text || '%'))
);

-- 3. Authenticated Update (UPDATE)
create policy "Users can update their own avatar"
on storage.objects for update
to authenticated
using (
  bucket_id = 'avatars' AND
  owner = auth.uid()
)
with check (
  bucket_id = 'avatars' AND
  owner = auth.uid()
);

-- 4. Authenticated Delete (DELETE)
create policy "Users can delete their own avatar"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'avatars' AND
  owner = auth.uid()
);


-- ==========================================
-- USER PROFILES POLICIES
-- ==========================================

-- Enable RLS on user_profiles if not already enabled
alter table user_profiles enable row level security;

-- Drop existing policies on user_profiles to ensure clean state
drop policy if exists "Users can view their own profile" on user_profiles;
drop policy if exists "Users can update their own profile" on user_profiles;
drop policy if exists "Public profiles are viewable by everyone" on user_profiles;
drop policy if exists "Authenticated users can view all profiles" on user_profiles;
drop policy if exists "Users can insert their own profile" on user_profiles;

-- 1. View Profiles
create policy "Authenticated users can view all profiles"
on user_profiles for select
to authenticated
using ( true );

-- 2. Update Own Profile
create policy "Users can update their own profile"
on user_profiles for update
to authenticated
using ( id = auth.uid() )
with check ( id = auth.uid() );

-- 3. Insert Profile
create policy "Users can insert their own profile"
on user_profiles for insert
to authenticated
with check ( id = auth.uid() );
