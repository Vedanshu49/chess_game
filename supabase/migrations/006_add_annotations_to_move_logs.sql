alter table public.move_logs
add column if not exists annotation text;
