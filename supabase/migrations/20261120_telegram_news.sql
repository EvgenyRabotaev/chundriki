-- Новая новость -> Telegram (Edge Function telegram-news). Секрет тот же, что у discord-sync (vault: discord_sync_secret).
create or replace function public.notify_telegram_news() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url := 'https://thqyyqjzjrauvpergywo.supabase.co/functions/v1/telegram-news',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-sync-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'discord_sync_secret')),
    body := jsonb_build_object('id', new.id), timeout_milliseconds := 20000);
  return new;
end $$;
drop trigger if exists news_to_telegram on public.news;
create trigger news_to_telegram after insert on public.news for each row execute function public.notify_telegram_news();
