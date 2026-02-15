-- 1. Create Data Structure for Mission Chat
create table if not exists public.mission_messages (
  id uuid default gen_random_uuid() primary key,
  mission_id uuid references public.missions(id) on delete cascade not null,
  user_id uuid references auth.users(id) not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Enable RLS
alter table public.mission_messages enable row level security;

-- 3. RLS Policies
-- Allow users to view messages if they are the creator, assignee, or a manager
create policy "Users can view messages for their missions"
  on public.mission_messages for select
  using (
    auth.uid() in (
      select assigned_to from public.missions where id = mission_id
    )
    or
    auth.uid() in (
      select created_by from public.missions where id = mission_id
    )
    or
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and role = 'manager'
    )
  );

-- Allow users to insert messages if they are part of the mission
create policy "Users can insert messages for their missions"
  on public.mission_messages for insert
  with check (
    auth.uid() in (
      select assigned_to from public.missions where id = mission_id
    )
    or
    auth.uid() in (
      select created_by from public.missions where id = mission_id
    )
    or
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and role = 'manager'
    )
  );

-- 4. Notification Logic via Trigger
create or replace function public.handle_new_mission_message()
returns trigger as $$
declare
  v_mission record;
  v_recipient_id uuid;
  v_sender_name text;
begin
  -- Get mission details
  select * into v_mission from public.missions where id = NEW.mission_id;
  
  -- Get sender's name
  select first_name || ' ' || last_name into v_sender_name
  from public.user_profiles
  where id = NEW.user_id;

  -- Determine Recipient
  if NEW.user_id = v_mission.assigned_to then
    -- Sender is the Technician -> Notify the Creator (Manager)
    v_recipient_id := v_mission.created_by;
  elsif NEW.user_id = v_mission.created_by then
    -- Sender is the Creator -> Notify the Technician
    v_recipient_id := v_mission.assigned_to;
  else
    -- Sender might be another Manager -> Notify Assigned Technician (default)
    v_recipient_id := v_mission.assigned_to;
  end if;

  -- Insert Notification if recipient exists and is not the sender
  if v_recipient_id is not null and v_recipient_id <> NEW.user_id then
    insert into public.notifications (user_id, type, title, content, link, created_at)
    values (
      v_recipient_id,
      'message',
      'Nouveau message mission',
      v_sender_name || ' : ' || substring(NEW.content from 1 for 50) || '...',
      '/missions',
      now()
    );
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

-- 5. Attach Trigger
drop trigger if exists on_mission_message_created on public.mission_messages;
create trigger on_mission_message_created
  after insert on public.mission_messages
  for each row execute procedure public.handle_new_mission_message();
