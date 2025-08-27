-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- profiles (bound to auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  rating integer not null default 1200,
  created_at timestamptz not null default now()
);

-- games table (invite, timers, etc.)
create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  creator uuid not null references public.profiles(id) on delete set null,
  opponent uuid references public.profiles(id) on delete set null,
  invite_code text unique,                          -- e.g., 6-char code
  fen text not null,                                -- current position
  moves jsonb not null default '[]'::jsonb,         -- array of UCI
  status text not null default 'waiting',           -- waiting | in_progress | checkmate | stalemate | draw | timeout | resigned
  turn text not null default 'white',               -- whose turn
  initial_time_seconds integer not null default 600,
  increment_seconds integer not null default 0,
  white_time_left integer not null default 600,
  black_time_left integer not null default 600,
  last_move_at timestamptz not null default now(),
  result text,                                      -- "1-0","0-1","1/2-1/2"
  pgn text,                                         -- final PGN on end
  created_at timestamptz not null default now()
);

-- Move logs: canonical move history
create table if not exists public.move_logs (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  move_number integer not null,                     -- 1-based ply counter
  uci text not null,
  san text,
  played_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists ix_games_invite_code on public.games(invite_code);
create index if not exists ix_moves_game_id on public.move_logs(game_id);

-- RLS
alter table public.profiles enable row level security;
alter table public.games enable row level security;
alter table public.move_logs enable row level security;

-- Policies
create policy "Profiles readable by all"
  on public.profiles for select using (true);

create policy "User manages own profile"
  on public.profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Games readable by all"
  on public.games for select using (true);

create policy "Creator can insert their games"
  on public.games for insert
  with check (auth.uid() = creator);

create policy "Participants can update their games"
  on public.games for update
  using (auth.uid() = creator or auth.uid() = opponent)
  with check (true);

-- Allow join by invite: set opponent when currently null
create policy "Anyone can set opponent if joining by invite"
  on public.games for update
  using (opponent is null)
  with check (true);

-- Move logs policies
create policy "Move logs readable by all"
  on public.move_logs for select using (true);

create policy "Participants can insert move logs"
  on public.move_logs for insert
  with check (
    exists (
      select 1 from public.games g
      where g.id = game_id and (auth.uid() = g.creator or auth.uid() = g.opponent)
    )
  );

create policy "Participants can delete move logs (for undo)"
  on public.move_logs for delete
  using (
    exists (
      select 1 from public.games g
      where g.id = game_id and (auth.uid() = g.creator or auth.uid() = g.opponent)
    )
  );

-- NOTE: Enable Realtime on tables: games, move_logs (in the dashboard).
