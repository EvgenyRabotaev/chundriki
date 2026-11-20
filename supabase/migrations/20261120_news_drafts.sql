-- Черновики новостей: не видны на сайте и не уходят в Telegram до публикации
alter table public.news add column if not exists status text not null default 'published' check (status in ('draft','published'));
alter table public.news add column if not exists preview_token uuid not null default gen_random_uuid();

drop policy if exists news_read on public.news;
create policy news_read on public.news for select to anon, authenticated using (status = 'published');

create or replace function public.news_preview(p_id bigint, p_token uuid)
returns table(id bigint, title text, body text, image_url text, source_url text, source_name text, published_at timestamptz, pinned boolean, status text)
language sql stable security definer set search_path = public as $$
  select n.id, n.title, n.body, n.image_url, n.source_url, n.source_name, n.published_at, n.pinned, n.status
  from news n where n.id = p_id and n.preview_token = p_token
$$;
revoke all on function public.news_preview(bigint, uuid) from public;
grant execute on function public.news_preview(bigint, uuid) to anon, authenticated;

-- при публикации черновика дата = момент публикации
create or replace function public.news_on_publish() returns trigger language plpgsql as $$
begin
  if new.status = 'published' and old.status = 'draft' then new.published_at := now(); end if;
  return new;
end $$;
drop trigger if exists news_publish_date on public.news;
create trigger news_publish_date before update of status on public.news for each row execute function public.news_on_publish();

-- в Telegram — только опубликованные: при вставке сразу опубликованной или при переводе из черновика
drop trigger if exists news_to_telegram on public.news;
create trigger news_to_telegram after insert on public.news for each row when (new.status = 'published') execute function public.notify_telegram_news();
drop trigger if exists news_to_telegram_publish on public.news;
create trigger news_to_telegram_publish after update of status on public.news for each row
  when (old.status = 'draft' and new.status = 'published') execute function public.notify_telegram_news();
