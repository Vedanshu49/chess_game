-- Game actions table for offers and requests
create table if not exists public.game_actions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  action_type text not null,  -- 'draw_offer', 'rematch_offer', 'abort_request'
  from_user uuid not null references public.profiles(id) on delete cascade,
  to_user uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending', -- 'pending', 'accepted', 'declined', 'expired'
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '2 minutes'),
  responded_at timestamptz
);

-- Index for faster lookups
create index if not exists ix_game_actions_game on public.game_actions(game_id);
create index if not exists ix_game_actions_users on public.game_actions(from_user, to_user);
create index if not exists ix_game_actions_status on public.game_actions(status);

-- Enable RLS
alter table public.game_actions enable row level security;

-- Policies
create policy "Game actions readable by participants"
  on public.game_actions for select
  using (
    exists (
      select 1 from public.games g
      where g.id = game_id and (auth.uid() = g.creator or auth.uid() = g.opponent)
    )
  );

create policy "Participants can create game actions"
  on public.game_actions for insert
  with check (
    exists (
      select 1 from public.games g
      where g.id = game_id and (auth.uid() = g.creator or auth.uid() = g.opponent)
    )
  );

create policy "Action recipients can update responses"
  on public.game_actions for update
  using (auth.uid() = to_user)
  with check (status in ('accepted', 'declined'));

-- Enable realtime
alter publication supabase_realtime add table game_actions;
