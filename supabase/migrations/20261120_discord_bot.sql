-- Таблицы Discord-бота. RLS включён, политик нет: anon и authenticated доступа не имеют,
-- Edge Functions работают с service_role.
create table if not exists public.bot_config (key text primary key, value text, updated_at timestamptz not null default now());
create table if not exists public.discord_registrations (
  discord_id text primary key, game_nick text not null, real_name text, discord_username text,
  registered_at timestamptz not null default now());
create table if not exists public.discord_pings (discord_id text primary key, pinged_at timestamptz not null default now());
create table if not exists public.bot_sync_report (
  id bigint generated always as identity primary key,
  kind text not null, member_id bigint, discord_id text, game_nick text, details text,
  created_at timestamptz not null default now(), unique (kind, member_id));
alter table public.bot_config enable row level security;
alter table public.discord_registrations enable row level security;
alter table public.discord_pings enable row level security;
alter table public.bot_sync_report enable row level security;
revoke all on public.bot_config, public.discord_registrations, public.discord_pings, public.bot_sync_report from anon, authenticated;
-- админам разрешаем читать отчёт синхронизации (для будущей вкладки в админке)
grant select on public.bot_sync_report to authenticated;
drop policy if exists report_admin_read on public.bot_sync_report;
create policy report_admin_read on public.bot_sync_report for select to authenticated using (public.is_admin());

create extension if not exists pg_net;
create extension if not exists pg_cron;
-- Секрет для вызова discord-sync лежит в vault (имя discord_sync_secret), в репозитории его нет.
-- Расписание: каждые 5 минут.
select cron.unschedule('discord-sync') where exists (select 1 from cron.job where jobname = 'discord-sync');
select cron.schedule('discord-sync', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://thqyyqjzjrauvpergywo.supabase.co/functions/v1/discord-sync',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-sync-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'discord_sync_secret')),
    body := '{}'::jsonb, timeout_milliseconds := 50000);
$$);
