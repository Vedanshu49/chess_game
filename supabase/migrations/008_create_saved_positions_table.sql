create table if not exists public.saved_positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  fen text not null,
  created_at timestamptz not null default now()
);

alter table public.saved_positions enable row level security;

create policy "Users can view their own saved positions"
  on public.saved_positions for select
  using (auth.uid() = user_id);

create policy "Users can insert their own saved positions"
  on public.saved_positions for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own saved positions"
  on public.saved_positions for delete
  using (auth.uid() = user_id);
