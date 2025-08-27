
create table if not exists public.friends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending', -- pending | accepted | rejected
  created_at timestamptz not null default now(),
  unique(user_id, friend_id)
);

alter table public.friends enable row level security;

create policy "Users can view their own friend relationships"
  on public.friends for select
  using (auth.uid() = user_id or auth.uid() = friend_id);

create policy "Users can insert their own friend requests"
  on public.friends for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own friend requests"
  on public.friends for update
  using (auth.uid() = friend_id)
  with check (auth.uid() = friend_id);

create policy "Users can delete their own friend relationships"
    on public.friends for delete
    using (auth.uid() = user_id or auth.uid() = friend_id);
