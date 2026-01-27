-- Create table for procedure suggestions
create table if not exists procedure_suggestions (
  id uuid default gen_random_uuid() primary key,
  procedure_id uuid references procedures(uuid) not null,
  user_id uuid references auth.users(id) not null,
  suggestion text not null,
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add RLS policies
alter table procedure_suggestions enable row level security;

-- Policy: Users can create suggestions
create policy "Users can create suggestions"
  on procedure_suggestions for insert
  with check (auth.uid() = user_id);

-- Policy: Users can view their own suggestions
create policy "Users can view own suggestions"
  on procedure_suggestions for select
  using (auth.uid() = user_id);

-- Policy: Managers can view all suggestions
create policy "Managers can view all suggestions"
  on procedure_suggestions for select
  using (
    exists (
      select 1 from user_profiles
      where user_profiles.id = auth.uid()
      and user_profiles.role = 'MANAGER'
    )
  );
