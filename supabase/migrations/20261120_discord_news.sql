-- Опубликованные новости также уходят в Discord (канал Chat) через Edge Function discord-news
insert into public.bot_config(key, value) values ('discord_news_channel_id', '1438991254141800459')
  on conflict (key) do update set value = excluded.value;

create or replace function public.notify_telegram_news() returns trigger
language plpgsql security definer set search_path = public as $$
declare s text := (select decrypted_secret from vault.decrypted_secrets where name = 'discord_sync_secret');
begin
  perform net.http_post(
    url := 'https://thqyyqjzjrauvpergywo.supabase.co/functions/v1/telegram-news',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-sync-secret', s),
    body := jsonb_build_object('id', new.id), timeout_milliseconds := 20000);
  perform net.http_post(
    url := 'https://thqyyqjzjrauvpergywo.supabase.co/functions/v1/discord-news',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-sync-secret', s),
    body := jsonb_build_object('id', new.id), timeout_milliseconds := 20000);
  return new;
end $$;
