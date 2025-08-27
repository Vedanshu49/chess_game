alter table public.profiles
add column if not exists wins integer not null default 0,
add column if not exists losses integer not null default 0,
add column if not exists draws integer not null default 0;
