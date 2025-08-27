-- Chat messages table
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);

-- User preferences table (for themes, sounds, etc)
create table if not exists public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  board_theme text not null default 'default',
  piece_theme text not null default 'default',
  sound_enabled boolean not null default true,
  premoves_enabled boolean not null default true,
  animation_duration integer not null default 200,
  piece_drag_mode text not null default 'drag', -- 'drag' or 'click'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Game history view for easy querying
create view public.game_history as
select 
  g.*,
  white.username as white_username,
  black.username as black_username,
  white.rating as white_rating,
  black.rating as black_rating
from public.games g
left join public.profiles white on (g.creator = white.id)
left join public.profiles black on (g.opponent = black.id)
where g.status not in ('waiting', 'in_progress')
order by g.created_at desc;

-- Indexes
create index if not exists ix_chat_messages_game on public.chat_messages(game_id);
create index if not exists ix_chat_messages_user on public.chat_messages(user_id);
create index if not exists ix_chat_messages_created on public.chat_messages(created_at);

-- RLS policies
alter table public.chat_messages enable row level security;
alter table public.user_preferences enable row level security;

-- Chat message policies
create policy "Chat messages readable by game participants"
  on public.chat_messages for select
  using (
    exists (
      select 1 from public.games g
      where g.id = game_id and (auth.uid() = g.creator or auth.uid() = g.opponent)
    )
  );

create policy "Users can send chat messages in their games"
  on public.chat_messages for insert
  with check (
    auth.uid() = user_id and
    exists (
      select 1 from public.games g
      where g.id = game_id and (auth.uid() = g.creator or auth.uid() = g.opponent)
    )
  );

-- User preferences policies
create policy "Users can read their own preferences"
  on public.user_preferences for select
  using (auth.uid() = user_id);

create policy "Users can update their own preferences"
  on public.user_preferences for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can insert their preferences"
  on public.user_preferences for insert
  with check (auth.uid() = user_id);

-- Enable realtime
alter publication supabase_realtime add table chat_messages;
