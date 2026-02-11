-- Consolidation of fixes applied on 2026-02-11

-- 1. Fix user_profiles RLS to allow cross-user visibility
-- Essential for chat and missions to see names of colleagues/managers
drop policy if exists "Enable read access for all authenticated users" on public.user_profiles;
create policy "Enable read access for all authenticated users"
  on public.user_profiles for select
  to authenticated
  using (true);

-- 2. Repair mission_messages trigger with NULL handling
-- Prevents 400 errors when sender has incomplete profile (missing first_name/last_name)
create or replace function public.handle_new_mission_message()
returns trigger as $$
declare
  recipient_id uuid;
  mission_title text;
  sender_name text;
begin
  -- Get mission info and determine recipient (Technician <-> Manager)
  select 
    title,
    case 
      when new.user_id = assigned_to then created_by
      else assigned_to
    end into mission_title, recipient_id
  from public.missions where id = new.mission_id;
  
  -- Get sender name with robust fallback
  select coalesce(first_name || ' ' || last_name, email, 'Utilisateur') into sender_name 
  from public.user_profiles where id = new.user_id;
  
  -- Extra safety fallback
  if sender_name is null then
    sender_name := 'Collaborateur';
  end if;
  
  -- Insert notification if recipient is valid
  if recipient_id is not null and recipient_id != new.user_id then
    insert into public.notifications (user_id, type, title, content, link)
    values (
      recipient_id,
      'mission_chat',
      'Nouveau message : ' || coalesce(mission_title, 'Mission'),
      sender_name || ' : ' || left(new.content, 100),
      '/missions'
    );
  end if;
  
  return new;
end;
$$ language plpgsql security definer;
