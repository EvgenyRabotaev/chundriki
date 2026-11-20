create table if not exists public.discord_role_pings (discord_id text primary key, pinged_at timestamptz default now());
alter table public.discord_role_pings enable row level security;
