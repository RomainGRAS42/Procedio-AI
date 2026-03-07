create table public.direct_messages (
  id uuid not null default gen_random_uuid (),
  sender_id uuid not null references public.user_profiles (id) on delete cascade,
  recipient_id uuid not null references public.user_profiles (id) on delete cascade,
  procedure_id uuid references public.procedures (uuid) on delete set null,
  content text not null,
  is_read boolean not null default false,
  created_at timestamp with time zone not null default now (),
  constraint direct_messages_pkey primary key (id)
);

alter table public.direct_messages enable row level security;

create policy "Users can read their own messages" on public.direct_messages
  for select using (auth.uid() = sender_id or auth.uid() = recipient_id);

create policy "Users can insert messages" on public.direct_messages
  for insert with check (auth.uid() = sender_id);

create policy "Users can update their own received messages (mark as read)" on public.direct_messages
  for update using (auth.uid() = recipient_id);
