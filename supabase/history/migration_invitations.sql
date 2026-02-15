-- Table des invitations
create table if not exists invitations (
  id uuid default gen_random_uuid() primary key,
  email text not null,
  role text not null check (role in ('manager', 'technicien')),
  token text default gen_random_uuid()::text,
  status text default 'pending' check (status in ('pending', 'accepted')),
  invited_by uuid references auth.users(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS pour invitations
alter table invitations enable row level security;

-- Les managers peuvent voir et créer des invitations
-- Note: on vérifie le rôle 'manager' (minuscule) dans user_profiles
create policy "Managers can view invitations"
  on invitations for select
  using (auth.uid() in (select id from user_profiles where role = 'manager'));

create policy "Managers can create invitations"
  on invitations for insert
  with check (auth.uid() in (select id from user_profiles where role = 'manager'));

-- Trigger pour assigner le rôle à l'inscription
create or replace function public.handle_new_user_invitation()
returns trigger as $$
declare
  invited_role text;
begin
  -- Vérifier si l'email existe dans les invitations
  select role into invited_role
  from public.invitations
  where email = new.email
  and status = 'pending'
  limit 1;

  if invited_role is not null then
    -- Mettre à jour le rôle dans user_profiles
    -- On utilise un cast ::user_role car la colonne est de type enum user_role
    
    update public.user_profiles
    set role = invited_role::user_role
    where id = new.id;
    
    -- Si le profil n'existe pas encore (race condition rare), on l'insère
    if not found then
      insert into public.user_profiles (id, email, role, first_name)
      values (new.id, new.email, invited_role::user_role, split_part(new.email, '@', 1));
    end if;

    -- Marquer l'invitation comme acceptée
    update public.invitations
    set status = 'accepted'
    where email = new.email;
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- Attacher le trigger à auth.users
drop trigger if exists on_auth_user_created_invitation on auth.users;
create trigger on_auth_user_created_invitation
  after insert on auth.users
  for each row execute procedure public.handle_new_user_invitation();
